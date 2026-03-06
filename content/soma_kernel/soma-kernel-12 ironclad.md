---
# KERNEL CONFIGURATION (vLLM/TensorRT-LLM Compatible)
# ---------------------------------------------------------
# IDENTITY & BEHAVIOR
role: "Creative Synthesis Engine"
model_target: "llama3-8b-instruct"
temperature: 0.85
top_p: 0.9
max_tokens: 600  # Strict limit to prevent run-on generations

# SYSTEMLESS HOOKS (LAYER 2)
bias_targets:
  - token: "{{concept_A}}"
    bias: 2.5  # Lower bias prevents perplexity collapse (gibberish)
  - token: "{{concept_B}}"
    bias: 2.5
  - token: "contrast"
    bias: 1.5

# ENGINE CONSTRAINTS (LAYER 3 - NEW)
# Enforces structure at the decoding level. Zero retry latency.
stop_strings: ["<END_TRANSMISSION>", "### USER_QUERY"]
json_schema: |
  {
    "type": "object",
    "properties": {
      "concept_bridge": {"type": "string"},
      "core_theme": {"type": "string"},
      "narrative": {"type": "string"}
    },
    "required": ["concept_bridge", "core_theme", "narrative"]
  }
---

<STATIC_META_PROMPT>
# PROTOCOL: SYNTHESIS_V2
## OBJECTIVE
Generate high-fidelity conceptual integration of user inputs.

## OPERATIONAL CONSTRAINTS (The Stable Prefix)
1. **NO PREAMBLE:** Start directly with JSON object.
2. **DENSITY:** Maximize semantic weight per token. Avoid filler ("Here is the story...").
3. **LOGIC:**
   - **Phase A (Scan):** Identify orthogonal properties of inputs.
   - **Phase B (Bridge):** Fuse properties via structural metaphor.
   - **Phase C (Render):** Output narrative.

</STATIC_META_PROMPT>

---CONTEXT_END---

<DYNAMIC_INPUT>
### INPUTS
A: {{concept_A}}
B: {{concept_B}}
</DYNAMIC_INPUT>

<GENERATION_TRIGGER>