---
id: SOMA-KERNEL-12G
date: "2026-03-06"
title: "MISSION: DEEP SYNTHESIS"
type: "kernel"
---
<STATIC_META_PROMPT>
# MISSION: DEEP SYNTHESIS

## OBJECTIVE
Integrate the provided concepts into a cohesive narrative. 

## CONSTRAINT: HIDDEN REASONING
Use your internal chain-of-thought capabilities to:
1.  Analyze the material properties of Concept A.
2.  Analyze the symbolic properties of Concept B.
3.  Find a non-obvious intersection (divergent thinking).

## OUTPUT FORMAT
Return ONLY the JSON object defined in the schema. 
</STATIC_META_PROMPT>

---CONTEXT_END---

<DYNAMIC_INPUT>
### INPUTS
A: {{concept_A}}
B: {{concept_B}}
</DYNAMIC_INPUT>

<GENERATION_TRIGGER>