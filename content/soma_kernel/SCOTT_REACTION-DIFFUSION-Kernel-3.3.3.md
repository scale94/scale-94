# Gray-Scott Reaction-Diffusion Engine

This module implements a continuous dynamical system modeling the interaction of two chemical species, $u$ and $v$. The simulation computes spatial concentrations over a 2D grid, rendering the results as real-time ASCII density maps within the system kernel logs.



## Mathematical Architecture

The simulation relies on a coupled system of non-linear partial differential equations (PDEs). Species $u$ is replenished at a constant feed rate $f$, while species $v$ catalyzes the conversion of $u$ into $v$ before decaying at a kill rate $k$.

The evolution of the system over time $t$ is defined by:

$$\frac{\partial u}{\partial t} = D_u \nabla^2 u - u v^2 + f(1 - u)$$
$$\frac{\partial v}{\partial t} = D_v \nabla^2 v + u v^2 - (f + k)v$$

Where:
* $D_u, D_v$ are the spatial diffusion coefficients.
* $\nabla^2$ is the Laplacian operator, approximated via a 5-point discrete finite difference method.
* $u v^2$ represents the non-linear reaction mechanism.

---

## WASM Integration & Animation Loop

To stream the computed ASCII density states into your frontend terminal UI, you must instantiate the kernel and set up a non-blocking requestAnimationFrame loop.

### `scripts/import-rust.js` (Frontend Bridge)

```javascript
import { GrayScottKernel, CommandRegistry } from './pkg/ars_electronica_kernel.js';

// 1. Register the autocomplete parameters
const gsParams = CommandRegistry.get_grayscott_params();
console.log(`[SYS] Registered autocomplete for 'run grayscott': ${gsParams.join(' ')}`);

// 2. Initialize the Kernel state memory
// For standard terminal line heights, 60x30 provides a stable aspect ratio
const KERNEL_WIDTH = 60;
const KERNEL_HEIGHT = 30;
let activeKernel = null;
let animationFrameId = null;

/**
 * Executes the Gray-Scott mathematical simulation and pipes to system kernel logs.
 * Recommended starting parameters for mitosis-like cell division – Feed: 0.036, Kill: 0.065
 */
export function run_grayscott(terminal, feedRate = 0.036, killRate = 0.065, framesPerRender = 10) {
    if (activeKernel) {
        activeKernel.free(); // Prevent WASM memory leaks
    }
    
    terminal.print("[SYS] ALLOCATING WASM HEAP MEMORY FOR REACTION-DIFFUSION LATTICE...\n");
    activeKernel = new GrayScottKernel(KERNEL_WIDTH, KERNEL_HEIGHT);
    
    // Clear previous system kernel logs loop if running
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    function renderLoop() {
        // Compute the PDEs and retrieve the ASCII string payload
        const kernelOutput = activeKernel.compute_steps(feedRate, killRate, framesPerRender);
        
        // Clear terminal screen and pipe the new frame
        terminal.clear();
        terminal.print(kernelOutput);
        
        // Continue simulation
        animationFrameId = requestAnimationFrame(renderLoop);
    }
    
    // Initiate continuous output
    renderLoop();
}

// Example hook for the terminal UI:
// terminal.onCommand('run grayscott', (args) => run_grayscott(terminal, parseFloat(args[0]), parseFloat(args[1])));