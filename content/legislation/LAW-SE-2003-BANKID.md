---
id: LAW-SE-2003-BANKID
title: "BankID / Swedish Digital Identity Infrastructure"
legalName: "BankID (private system, government-recognized eID)"
type: "legislation"
status: "ACTIVE"
severity: 3
severityLabel: "ELEVATED"
location: "Sweden"
jurisdiction: "National"
legislationStatus: "ACTIVE"
categories: ["digital_id", "biometric_collection"]
tags: ["Legislation", "Governance", "Surveillance", "Digital Id", "Biometric Collection", "Sweden"]
date: "2026-03-10"
sourceUrl: "https://raw.githubusercontent.com/grey-c0/legislation/main/public/legislation.json"
---
# BankID / Swedish Digital Identity Infrastructure

## BankID (private system, government-recognized eID)

| Field | Value |
|---|---|
| **Location** | Sweden |
| **Jurisdiction** | National |
| **Status** | ACTIVE |
| **Severity** | 3/5 — ELEVATED |
| **Categories** | digital_id, biometric_collection |

## Description

BankID is the dominant digital identity system in Sweden, created by banks in 2003. Government-recognized eID with 8.6+ million active users (2024). Required for banking, government services, healthcare, and employment. 87% of population considers it most important app. Requires Swedish personal identity number (personnummer) and bank account, excluding undocumented migrants and recent arrivals.

## Severity Rationale

> Near-universal adoption - 99.9% of adults 18-67 [+1], no criminal penalties [+0], biometric authentication (fingerprint/face) [+0.5], potential chilling effect through transaction tracking [+0.5], mission creep to all digital services [+0.5], private sector control with government recognition [+0], digital exclusion for those without bank account or personnummer [+0.5]. Total: 3/5 (Medium)

## Implementation Notes

De facto mandatory for participation in Swedish digital society. Run by private banks (Finansiell ID-Teknik BID AB) but government-recognized. Creates dependency on banking sector for identity. Freja eID is alternative for those without personnummer but less widely accepted. Biometric authentication (fingerprint/face) increasingly required. No meaningful alternative for accessing essential services. Raises competition and data protection concerns. Transaction data valuable for surveillance if accessed by state.

## Sources

- **[PRIMARY]** [BankID official website - system information and statistics](https://www.bankid.com/)
- **[NEWS]** [IDURA analysis of BankID and Freja eID systems](https://idura.eu/blog/bankid-freja)
- **[PRIMARY]** [Swedish Agency for Digital Government (DIGG) - eID framework](https://www.digg.se/digital-samverkan/e-legitimering/e-identifikation)

---

> **Source:** @grey-c0 / Navigators Guild  
> Retrieved via [grey-c0/legislation](https://github.com/grey-c0/legislation)  
> Integrated into scale_9.4 CAS pipeline — do not edit stubs manually.
