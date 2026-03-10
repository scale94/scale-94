---
id: LAW-NL-2024-DATA-RETENTION
title: "Dutch Telecommunications Data Retention"
legalName: "Dutch implementation of data retention under Telecommunicatiewet and Wet op de inlichtingen- en veiligheidsdiensten"
type: "legislation"
status: "ACTIVE"
severity: 3
severityLabel: "ELEVATED"
location: "Netherlands"
jurisdiction: "National"
legislationStatus: "ACTIVE"
categories: ["data_retention", "traffic_retention"]
tags: ["Legislation", "Governance", "Surveillance", "Data Retention", "Traffic Retention", "Netherlands"]
date: "2026-03-10"
sourceUrl: "https://raw.githubusercontent.com/grey-c0/legislation/main/public/legislation.json"
---
# Dutch Telecommunications Data Retention

## Dutch implementation of data retention under Telecommunicatiewet and Wet op de inlichtingen- en veiligheidsdiensten

| Field | Value |
|---|---|
| **Location** | Netherlands |
| **Jurisdiction** | National |
| **Status** | ACTIVE |
| **Severity** | 3/5 — ELEVATED |
| **Categories** | data_retention, traffic_retention |

## Description

Netherlands requires telecommunications providers to retain metadata (call records, location data, internet traffic) for law enforcement and intelligence access. Implementation follows CJEU rulings with some safeguards.

## Severity Rationale

> Universal application (all telecom users) [+1], limited judicial oversight (retention authorized by minister, access requires court order) [+0.5], irreversible data collection (metadata retention) [+0.5], mission creep concerns [+0.5], digital exclusion not applicable [0]. Total: 2.5/5 rounded to 3/5

## Implementation Notes

Dutch data retention framework operates under: (1) Telecommunicatiewet for law enforcement; (2) Wiv 2017 for intelligence services. Post-CJEU adjustments: Netherlands has adjusted retention rules following Digital Rights Ireland and Tele2 rulings but maintains retention for serious crime and national security. Current regime: (1) Retention periods reduced compared to pre-2014; (2) Access requires judicial authorization for law enforcement; (3) Intelligence services have broader access under Wiv 2017. Concerns: (1) Retention still broad despite CJEU limits; (2) Intelligence access less restricted than law enforcement; (3) Bulk interception under Wiv 2017 captures data before retention rules apply; (4) Lack of transparency about retention periods and access statistics. Opposition: Privacy First and digital rights groups continue challenging. EDRi monitoring. Compared to Belgium/France, Netherlands has somewhat stricter safeguards but still maintains surveillance infrastructure. Workers' concern: Metadata retention reveals worker networks, union contacts, organizing patterns. Location data particularly sensitive for tracking worker movements and meeting locations.

## Sources

- **[PRIMARY]** [Telecommunicatiewet (Dutch Telecommunications Act)](https://wetten.overheid.nl/BWBR0009950/2024-01-01)
- **[CIVIL_SOCIETY]** [Comparative analysis of Dutch data retention implementation](https://verfassungsblog.de/data-retention/)

---

> **Source:** @grey-c0 / Navigators Guild  
> Retrieved via [grey-c0/legislation](https://github.com/grey-c0/legislation)  
> Integrated into scale_9.4 CAS pipeline — do not edit stubs manually.
