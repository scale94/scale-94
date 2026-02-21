
---

# 🎮 Networking Architecture: CS2 vs CS:GO

## 1. Introduction

Both **CS:GO** and **CS2** operate in a **server-authoritative** manner. The core function is the transfer of **user inputs (usercommands)** from the client to the server and **game-state information** from the server to the client. This discussion focuses on how this data transfer fundamentally differs between the two games on a higher level.

**What this post is about:**

- How CS:GO and CS2 differ in **when** gamestate and user input data are sent and received.
    
- How certain networking conditions can **increase your latency** without showing up on telemetry or the scoreboard (known as **hidden latency**).
    

**What this post is not about:**

- Subtick mechanics.
    
- Lag compensation.
    

---

### 1.1 Real World Obstacles

Data transfer in real-world networks faces several challenges:

- **Latency (Ping):** The time it takes for data to travel to and from the server. This fundamentally necessitates the use of **prediction** on the client side to avoid waiting for server feedback.
    
- **Jitter:** The variance in packet arrival time.
    
    - **Micro-jitter:** Small, expected variance.
        
    - **Macro-jitter:** Sudden large spikes (lag-spikes), which can effectively act as packet loss.
        
- **Packet Loss:** Dropped packets. In this discussion, **loss** includes both actual packet loss and effective loss due to macro-jitter.
    
- Clock-Drift: The client's perceived time running slower or faster than the server's time, leading to either packet starvation (not enough packets) or flooding (too many packets).
    
    *
    
    *
    
- **Interpolation:** To ensure smooth visual movement, the client doesn't display the latest position instantly. Instead, it smoothly transitions between the previous and the current received state. This introduces an inherent delay, typically averaging **half a tick** behind real-time.
    
    - [Video 1.1 - light red is the full tick position, dark red is the previous full tick position, blue the interpolated position]
        

---

## 2. CS:GO

### 2.1 Data Transfer in CS:GO

CS:GO uses a simpler, synchronized model:

- **Client Tick:** Handles prediction, usercommand sending, and processing incoming game state information. This tick runs on frames.
    
- A usercommand sent on a client tick is typically processed by the server on its **next** tick, and the resulting game-state information is processed by the client on the client tick **after** it's received.
    
- In the example provided, the result of an action takes **3 full ticks** to be displayed.
    

---

### 2.2 Usercommand Flow Stability through Multi-Execution

CS:GO's primary mechanism for handling **micro-jitter** and minor **loss** on the usercommand side is **multi-execution** and **command redundancy**.

- **Jitter Handling:**
    
    - Since usercommand sending isn't synchronized with the server's tick processing, packets frequently arrive late (miss the processing window).
        
    - The server allocates an additional command **budget** each tick. If a command arrives late, the server executes **multiple usercommands** (e.g., two) in the subsequent tick to catch up.
        
    - The maximum allowed execution is set by `sv_maxusrcmdprocessticks` (default 16 commands), which can enable up to **125ms of motion** to be processed in one tick on a 128-tick server.
        
    - [Video 2.1]
        
- **Loss Handling:**
    
    - The client sends the **last three usercommands** together (`cl_cmdbackup`). This redundancy compensates for up to two consecutive lost command packets.
        

---

### 2.3 The Role of Additional Interpolation

CS:GO utilizes an **additional tick of interpolation delay** to mitigate the effects of **jitter** and **loss** on incoming game-state packets.

- **Client Jitter/Loss Handling:**
    
    - The minimum interpolation delay is **two ticks** (1 tick + `cl_interp_ratio`, which is set to 1 by default), not one.
        
    - If a game-state packet misses the expected arrival window, the client can use the available second-oldest state to continue interpolating, preventing visual stutter.
        
    - This also smooths over the visual jump caused by the server's multi-execution of usercommands (the skipped tick is simply interpolated over).
        
- **Clock-Drift Management:**
    
    - Clock-drift is detected by averaging the tick offset over the last 16 ticks.
        
    - The extra tick of interpolation delay provides a buffer (or **margin**) to prevent the client from running out of game-state information while the clock correction mechanism adjusts the client's internal tick rate.
        

---

## 3. CS2

### 3.1 Data Transfer in CS2

CS2 implements a revamped architecture:

- **Split Client Ticks:** The former combined client tick is split into two asynchronous components:
    
    - **Client-Output and Send Tick (Red):** Handles usercommand generation, sending (asynchronously), and prediction.
        
    - **Client-World-State and Receive Tick (Blue):** Handles incoming game-state packets and determines the theoretical time for interpolation.
        

---

### 3.2 Receive-Margin Management

CS2 uses **dynamic receive-margin management** on both the client and server to replace CS:GO's fixed interpolation delay for clock-correction.

- **Mechanism:** The time of packet arrival is measured, and the delta to the consumption time (the **receive margin**) is calculated.
    
- **Synchronization:** The server provides feedback on its receive margin, allowing the client to adjust its command generation rate (speed up or slow down) to maintain a **target margin** (default is **5ms**).
    
- **Benefit:** This allows the system to adjust _before_ starvation occurs, making the fixed extra tick of interpolation delay for clock correction obsolete.
    

---

### 3.3 Buffering, Usercommand-Redundancy, and Limited Multi-Execution

CS2 moves away from CS:GO's extensive multi-execution.

- **Server Processing:** The server will **not execute more than one full usercommand per tick**.
    
- **Command Queue:** Arriving usercommands enter a command-queue whose length is directly linked to the server receive-margin (e.g., a 1-2 tick margin means a queue length of one).
    
- **Stability for Loss/Jitter:**
    
    - The client sends the **last four usercommands** together.
        
    - If instability is detected, the game speeds up the "client-output speed" to target a **longer receive-margin** (larger queue), ensuring lost packets can be completely compensated for (up to 3 lost packets in a row with $>3$ ticks of margin).
        
        - [Video 3.1 - Increasing our margin target by 5 ticks, you can see that we are out-speeding the the bot until the speed-up ends]
            
        - [Video 3.2 - Decreasing our margin target by 5 ticks, you can see that the bot is catching up to us until the slow-down ends]
            
- **Late Command Handling (Limited Multi-Execution):** If a packet arrives too late but not lost:
    
    - The server first duplicates the last known command to prevent stutters.
        
    - Then, it executes the late-arriving commands with a **timestep size of zero** (up to `sv_late_commands_allowed`, default 5). This ensures critical actions (shooting/movement) are processed without breaking prediction integrity by consuming the "on-time" command budget.
        
- **Prediction Latency:** Prediction runs **one tick ahead** compared to CS:GO to enable next-frame response, which counteracts the latency gained from removing the extra interpolation tick.
    

---

### 3.4 Client Sided Buffering

Client receive-margin management also handles jitter, loss, and clock-drift, but through an opposite adjustment mechanism compared to the server side.

- **Margin Adjustment:** The client changes its "client-world-state tick" speed.
    
    - **Slowing down** (decreasing the receiving rate) **increases** the receive-margin.
        
    - **Speeding up** (increasing the receiving rate) **decreases** the receive-margin.
        
- **Jitter/Loss Smoothing:** With a receive-margin of over one tick, single packets lost can be perfectly smoothed by interpolating between the tick before and after.
    

---

### 3.5 Hidden Latency

CS2's system dynamically trades **latency for stability** when network instability is detected by increasing the receive margins. This added delay is **opaque** to the player in normal ping displays.

- The **server receive-margin** (time to process input) and the **client receive-margin** (time to process game-state) both directly add to the total latency.
    
- This is the source of "hidden latency" and explains common complaints about latency disconnects.
    
- **Build Info (XX-YY-ZZ-AA-BB):**
    
    - **X:** Server receive-margin (ms)
        
    - **Y:** Round-trip latency (Ping)
        
    - **Z:** Client receive-margin (ms)
        
    - **A:** Server-to-client loss (%)
        
    - **B:** Client-to-server loss (%)
        

**Example Total Latency:** Server Margin (~7ms) + Ping (~10ms) + Client Margin (~7ms) = **~24ms**

---

## 4. Summary

The networking architecture of **CS2 is a complete revamp** designed to improve stability and consistency over CS:GO's model.

|**Feature**|**CS:GO (Source 1)**|**CS2 (Source 2)**|
|---|---|---|
|**Usercommand Jitter/Minor Loss**|Compensated via **Multi-execution** (running 2+ commands in one tick) and **3-command redundancy**.|Compensated via **Command Queue/Buffering**, **4-command redundancy**, and limited **zero-timestep late command execution**.|
|**Clock-Drift/Game-State Jitter**|Compensated via **Fixed Extra Tick** of interpolation delay (2-tick minimum) and simple tick-offset averaging.|Compensated via **Dynamic Receive-Margin Management** on both client/server to avoid starvation before it occurs.|
|**Latency Management**|Fixed, with jitter/loss handled by **warping** (multi-execution) or **stuttering** (late packets) being masked by high interpolation delay.|Dynamic: **Stability is traded for latency** by increasing the receive margins _only_ when network instability is detected.|
|**Impact on Players**|Vulnerable to intentional lag-switching and stuttering/teleportation with poor connections.|Avoids teleportation/lag-switching advantage but can introduce **hidden latency** due to dynamic margin adjustments.|

CS2's core strength is its ability to **dynamically** adjust the receive margins to maintain stability, leading to lower and more consistent latency under good conditions, while gracefully degrading under poor conditions by increasing the margin (and thus, hidden latency).

---

Would you like me to elaborate on any of the specific technical concepts mentioned, such as **interpolation**, **receive-margin management**, or **multi-execution**?




## 🔬 Source 2 Deep Dive: Rubikon and Volumetric Smokes

### 1. Rubikon Physics Engine: A Technical Shift

The transition from the third-party **Havok** engine to Valve's custom, in-house **Rubikon** physics engine is a significant technical change in Source 2.

|**Feature**|**CS:GO (Havok)**|**CS2 (Rubikon)**|**Relevance to Thesis**|
|---|---|---|---|
|**Engine Type**|Third-party physics middleware.|**Custom, CPU-based** rigid body engine.|**Licensing and Control**: Valve switched to Rubikon to **reduce licensing costs** (Havok typically required a fee for commercial products). This gives Valve full control for optimization and customization.|
|**Performance**|Performance started to slow down with around 12 to 20 stacked bodies.|Shows **more robust and stable simulation**. One test showed it starting to slow down around 200 bodies and crashing around 477.|**Scalability and Stability**: Rubikon offers an **insane jump** in simulation robustness over the older, modified Havok version used in CS:GO.|
|**Object Interaction**|Ragdolls and physics objects had limited interaction; Havok was often _underutilized_ in CS:GO.|Ragdolls now **interact with each other**. Rubikon includes support for **Cloth Simulation**.|**Complexity and Synchronization**: More complex physics interactions (like intersecting ragdolls) increase the number of physical constraints the server must calculate and synchronize for all players.|
|**Core Principle**|Physics was often considered a minor part of CS:GO gameplay.|Although physics (utility, ragdolls) is a central tactical element, swapping the engine meant **old grenade line-ups would likely break**.|**Gameplay Parity Failure**: The change in physics engine, while leading to better long-term stability, guaranteed an **initial failure of parity** with CS:GO's highly sensitive, competitive physics.|
|**Implementation**|Debugging and optimization were based on talks and documentation around 2014-2015.|The Rubikon engine is described as **modular** and can be modified to behave however Valve wants, allowing them to attempt to mimic the Source 1 physics parameters.|**Customizability**: Allows Valve to tailor the physics for the exact needs of CS2, but the initial porting and fine-tuning were a major development bottleneck.|

### 2. Volumetric Smokes: Networking and Rendering Challenges

The new smoke grenades in CS2 are no longer simple sprites; they are **dynamic, volumetric objects** that interact realistically with their environment and other players.

|**Challenge Area**|**Technical Impact**|**Link to Networking/Performance Failure**|
|---|---|---|
|**Performance/Rendering**|Volumetric smokes and Molotov effects are **particle heavy** and **significantly more demanding** than CS:GO's effects. Many players experience **substantial FPS drops** when multiple smokes are active.|**Frame Time Jitter:** The major FPS drops caused by smokes introduce massive frame time spikes and instability (macro-jitter), which directly impacts the client's ability to maintain a stable output rate for usercommands (as discussed in your initial networking analysis).|
|**Synchronization**|The smokes are dynamic; they **fill spaces naturally** and can be cleared with a bullet or an HE grenade. They likely use a 3D noise texture to modulate density.|**Complex State Replication:** Unlike simple position updates, the server must calculate and replicate the complex **dynamic state** (shape, density, transparency based on light/bullets) of a volumetric field across all clients, at a sub-tick level, without introducing major latency or stutter.|
|**Rendering Optimizations**|Performance drops are observed even when the smoke grenade is **outside the player's render area**. This suggests that the particles might be rendered **globally** or that the CPU load for physics/particle updates is not being properly culled.|**Resource Hogging:** If the physics/particle calculations for smokes are not properly optimized for culling, they waste significant CPU/GPU resources, leading to **poor 1% lows** and an unstable frame rate critical for competitive play.|
|**Visual Parity**|Smokes currently **do not block light sources** in CS2, allowing players to see **shadows** inside the smoke.|**Failure to Block Light:** The inability to have volumetric smoke cast shadows is likely due to an **inherent compute requirement**. Valve chose to omit this feature rather than "make people on lower end hardware suffer a lot more". This is a clear compromise between visual fidelity and performance scalability.|

---

## 🔬 Source 2 Deep Dive: Client-Side Failures

### 1. Shader Compilation and Stuttering (The Core Failure)

The most frequently reported and technically significant client-side failure is **shader compilation stuttering**.

- **The Technical Shift:** Modern graphics APIs like **DirectX 12 and Vulkan** (which Source 2 uses alongside Direct3D 11) move complexity from the driver to the game developers ("close to the metal"). This grants developers more freedom but requires them to handle low-level tasks, including **shader compilation**.
    
- **The Cause of Stutter:** Shaders are compiled from an intermediate format by the GPU driver into code the GPU can use.
    
    - If the game needs a shader for an object or effect that hasn't been encountered yet (and thus hasn't been cached), the **CPU must pause and compile it in real-time**. This heavy, sudden CPU load causes a **micro-stutter** or **hitch**.
        
- **Valve's Implementation Oversight (The Critique):** The "proper way" to handle this is to either **pre-compile all shaders** during installation/launch (on all available cores) or to use a **sufficiently smart system** to look ahead and compile shaders in the background _before_ they are needed. The ongoing need for players to manually delete and rebuild shader caches suggests that Valve's in-game compilation, background caching, or asset management was initially ineffective.
    
- **Caching Issues:** Users frequently report that the game requires **recompiling shaders after every driver update** (which deletes the old cache) or sometimes even **every time a map is loaded** after an update, demonstrating a failure in persistent caching logic.
    

### 2. Multi-Core Rendering (Multithreading) and Load Balancing

Source 2 was explicitly designed for multi-threading to use all available CPU cores, providing a smoother experience by removing hitches during gameplay.

- **Source 2's Goal:** The engine supports new graphics standards (Direct3D 11 and Vulkan) that allow for **better multi-core rendering**. Valve intended for Source 2 to use **any available CPU cores** to handle the heavy load of rendering, streaming, physics, and animation.
    
- **The Technical Challenge:** Effective multi-threading requires splitting work into small, independent sections and distributing them across cores (a **task-based** or **fork/join** approach). If one thread (e.g., the Game Thread or a specific rendering task) becomes overloaded, the **entire simulation must wait to synchronize**, causing frame pacing issues and stuttering.
    
- **Performance Issues (The Failure Point):** The stuttering in CS2 is attributed to **frame pacing problems** and inconsistent frame delivery, _despite_ high average FPS. This strongly indicates synchronization failures or **poor load balancing** in the multi-threaded architecture. The sudden, heavy **CPU load from real-time shader compilation** is likely a task that frequently bottlenecks the entire multi-threaded pipeline.
    
- **Legacy Context:** The older Source 1 engine had a "Multi-core rendering" option, the description for which was often confusing and could sometimes _lower_ performance or cause crashes, demonstrating that multi-core implementation has always been a complex hurdle for Valve.

##