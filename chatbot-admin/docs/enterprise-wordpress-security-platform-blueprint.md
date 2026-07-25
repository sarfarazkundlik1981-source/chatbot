# Enterprise WordPress Security, Malware Detection, Threat Intelligence, Digital Forensics, and Incident Response Platform Blueprint

Status: architecture proposal only. No implementation is authorized by this document.

## 1. Executive Intent

This blueprint specifies an enterprise-grade platform for WordPress security, malware detection, threat intelligence, digital forensics, and incident response. The design intentionally combines techniques from compiler engineering, static application security testing, endpoint detection and response, malware analysis, web security, distributed systems, and forensic case management.

The platform is designed to exceed common WordPress security products in depth of analysis, explainability, evidence handling, extensibility, and enterprise operation. It does not assume that superior static analysis alone beats operational threat intelligence. Competitors with larger install bases, managed response teams, and real-time attack telemetry may retain advantages in immediate global visibility unless this platform builds comparable telemetry-sharing, research, and incident response operations.

## 2. External Baseline Sources

The following public sources were used to ground competitive comparisons and standards choices:

- Sucuri website security platform: https://sucuri.net/
- Sucuri WordPress security plugin: https://sucuri.net/wordpress-security-plugin/
- Sucuri plugin listing: https://wordpress.org/plugins/sucuri-scanner/
- Wordfence website and product positioning: https://www.wordfence.com/
- Wordfence Free product page: https://www.wordfence.com/products/wordfence-free/
- Wordfence pricing and threat intelligence positioning: https://www.wordfence.com/products/pricing/
- Wordfence Q4 2025 threat intelligence report page: https://www.wordfence.com/blog/2026/02/quarterly-wordpress-threat-intelligence-report-q4-2025/
- Quttera WordPress malware scanner: https://quttera.com/wordpress-malware-scanner
- Quttera platform and API positioning: https://quttera.com/
- Quttera plugin update blog: https://blog.quttera.com/post/quttera-wordpress-security-plugin-bot-protection
- MalCare website: https://www.malcare.com/
- MalCare pricing and feature positioning: https://www.malcare.com/pricing/
- YARA official documentation: https://virustotal.github.io/yara/
- OASIS CTI STIX and TAXII standards: https://www.oasis-open.org/2021/06/23/stix-v2-1-and-taxii-v2-1-oasis-standards-are-published/
- OASIS CTI documentation: https://oasis-open.github.io/cti-documentation/
- OpenTelemetry documentation: https://opentelemetry.io/docs/
- CycloneDX standard: https://cyclonedx.org/

## 3. Competitive Baseline

### 3.1 Commonly Advertised Strengths

- Sucuri commonly advertises website monitoring, malware cleanup, cloud-based protection, hardening, malware scanning, core integrity checks, post-hack features, and alerts.
- Wordfence commonly advertises an endpoint firewall, malware scanner, WordPress-specific threat intelligence, vulnerability intelligence, IP blocklists, malware signatures, and managed response tiers.
- Quttera commonly advertises internal and external malware scanning, web malware and JavaScript obfuscation detection, blacklist intelligence, API access, AI positioning, bot protection, and brute-force defense.
- MalCare commonly advertises offsite/cloud scanning, one-click cleanup, firewall, vulnerability scanning, activity logging, automatic backups, performance-conscious scanning, and centralized management.

### 3.2 Intended Advantages of This Design

This platform is intended to exceed those products in the following architectural areas:

- Compiler-grade PHP analysis: parse trees, AST, control-flow graph, data-flow graph, interprocedural call graph, taint propagation, symbolic execution, deobfuscation, and explainable evidence trails.
- Forensic rigor: immutable evidence vault, chain of custody, timeline reconstruction, root cause analysis, incident graph, analyst notes, reproducible findings, and case exports.
- Multi-engine detection: cryptographic integrity, fuzzy hashing, YARA, semantic signatures, AST signatures, heuristics, ML scoring, IOC matching, behavioral sandboxing, and cross-site correlation.
- Explainability: every finding must include evidence, detector provenance, confidence, false-positive considerations, remediation preconditions, and reproducibility metadata.
- Enterprise extensibility: policy-as-code, plugin SDK, signed rule packs, sandboxed custom analyzers, REST API, CLI, desktop triage client, dashboard, SIEM export, STIX/TAXII support, and tenant isolation.
- WordPress ecosystem intelligence: plugin/theme provenance, vulnerability mapping, maintainer reputation, abandoned component detection, suspicious update detection, and supply-chain drift.
- Incident response planning: remediation graph, blast-radius analysis, backup validation, restore safety checks, post-clean integrity verification, and rollback.

### 3.3 Likely Competitor Advantages

Existing large providers may retain advantages in:

- Scale of telemetry from installed sites.
- Real-world attack traffic volume.
- Human-managed cleanup experience.
- Mature support operations.
- Brand trust and distribution.
- Existing vulnerability research pipelines.
- Operational data from millions of scans, firewall blocks, and remediations.

The proposed platform must therefore be designed not only as software, but as a research, telemetry, and response operation.

## 4. Assumptions and Justifications

### 4.1 Product Assumptions

- Assumption: The primary protected asset is WordPress, including core, plugins, themes, uploads, mu-plugins, drop-ins, configuration files, database content, server logs, and rendered HTTP output.
  Justification: WordPress compromise commonly spans files, database rows, scheduled tasks, injected content, and server configuration.

- Assumption: The platform must support both plugin-based in-site scanning and external agent/orchestrator scanning.
  Justification: Some customers need simple WordPress plugin deployment, while enterprises require out-of-band evidence collection and reduced trust in the compromised WordPress runtime.

- Assumption: A compromised WordPress runtime is not trusted.
  Justification: Malware can hook WordPress APIs, hide files, alter options, tamper with plugin behavior, and evade in-process scanners.

- Assumption: The platform must work without sending customer source code to a vendor cloud by default.
  Justification: Enterprises often have data residency, confidentiality, regulatory, and contractual constraints.

- Assumption: Cloud telemetry must be opt-in, minimized, documented, and privacy-preserving.
  Justification: Threat intelligence is useful, but source code, database content, and customer PII require strict handling.

- Assumption: Automated remediation must be conservative and reversible.
  Justification: False positives in WordPress can break production sites, destroy evidence, or remove business-critical customizations.

- Assumption: The system must explain findings to both security analysts and WordPress administrators.
  Justification: Effective remediation requires evidence, context, severity, confidence, and operational impact.

### 4.2 Technical Assumptions

- Assumption: PHP 5.6 through current PHP versions must be parsed where possible.
  Justification: Real WordPress estates include legacy systems even when unsupported by upstream PHP.

- Assumption: Modern JavaScript, HTML, CSS, Apache/Nginx config, SQL dumps, serialized PHP, and WordPress options must be analyzed.
  Justification: WordPress malware is frequently multi-language and database-backed.

- Assumption: The platform must support large installations with millions of files and multi-gigabyte databases.
  Justification: Enterprise multisite and WooCommerce estates can be very large.

- Assumption: Hash-only integrity verification is insufficient.
  Justification: Attackers use database persistence, polyglots, obfuscation, supply-chain compromise, and legitimate-looking PHP hooks.

- Assumption: AI detection is a supporting detector, not a source of truth.
  Justification: ML models are probabilistic, can drift, and require explainability and guardrails for security workflows.

- Assumption: Sandboxing must assume malicious samples attempt evasion.
  Justification: Web shells and droppers may check environment, time, IP, user agent, hostnames, and filesystem layout.

## 5. Product Vision

The platform is a WordPress-focused security operating system for prevention, detection, investigation, and recovery.

Primary vision:

- Detect known and unknown WordPress malware using layered static, semantic, behavioral, and intelligence-driven analysis.
- Preserve and explain evidence so incidents can be investigated, audited, and defended.
- Identify root cause, not just infected files.
- Recommend and safely execute remediation with rollback.
- Correlate threats across sites, tenants, campaigns, plugins, themes, infrastructure, and time.
- Provide an extensible research platform for new malware families, vulnerability classes, and ecosystem intelligence.

The platform must be usable by:

- Site owners.
- Managed WordPress providers.
- Agencies managing many sites.
- Enterprise security teams.
- Incident responders.
- Malware researchers.
- Hosting providers.
- Compliance and audit teams.

## 6. Scope

### 6.1 In Scope

- WordPress file integrity verification.
- PHP malware detection.
- JavaScript malware detection.
- HTML injection detection.
- Database forensic scanning.
- Web shell detection.
- Hidden persistence detection.
- Cron and scheduled task analysis.
- Plugin, theme, and core intelligence.
- Vulnerability intelligence.
- IOC and threat intelligence.
- Sandboxed dynamic behavior analysis.
- Static analysis with AST, CFG, DFG, taint, and symbolic execution.
- Forensic case management.
- Incident timeline reconstruction.
- Root cause analysis.
- Automatic remediation planning.
- Optional automated remediation execution.
- API, CLI, desktop client, and web dashboard.
- Enterprise identity, RBAC, audit logging, and deployment support.

### 6.2 Out of Scope for Initial Architecture

- Full generic EDR for arbitrary endpoints.
- Full WAF implementation as the first release.
- Replacing backup systems.
- Replacing SIEM systems.
- Guaranteed malware cleanup without human review for high-risk findings.
- Law enforcement evidence certification beyond defensible chain-of-custody controls.

## 7. Functional Requirements

### 7.1 Detection

- Scan WordPress core, plugins, themes, mu-plugins, uploads, drop-ins, wp-config.php, server config, cache directories, and custom paths.
- Parse PHP into AST for semantic analysis.
- Build CFG and DFG for selected files and call graph clusters.
- Run taint analysis from untrusted sources to dangerous sinks.
- Run bounded symbolic execution for suspicious code paths.
- Deobfuscate layered PHP and JavaScript malware.
- Detect web shells, backdoors, droppers, injectors, skimmers, SEO spam, redirectors, credential stealers, cryptominers, phishing kits, and persistence mechanisms.
- Analyze database rows for injected scripts, encoded payloads, malicious options, rogue users, altered roles, spam content, and cron payloads.
- Verify WordPress core, plugin, and theme files against trusted manifests where available.
- Identify unknown, abandoned, tampered, or suspicious plugins and themes.
- Detect vulnerable installed components and map exploitability to observed indicators.
- Run YARA rules against files, normalized code, decoded layers, and extracted payloads.
- Match IOCs such as domains, URLs, IPs, hashes, email addresses, wallet addresses, user agents, mutex-like tokens, campaign IDs, and C2 patterns.
- Correlate findings across files, database, HTTP output, logs, and multiple sites.

### 7.2 Forensics and Incident Response

- Preserve raw evidence before remediation.
- Maintain chain-of-custody metadata.
- Reconstruct timelines from file metadata, database timestamps, WordPress logs, web server logs, PHP logs, audit logs, backups, and scan events.
- Infer likely initial access vector.
- Build an incident graph linking vulnerabilities, files, users, IPs, IOCs, payloads, persistence, and remediations.
- Produce analyst-ready reports.
- Generate remediation plans with preconditions, risk, rollback, and verification steps.
- Support quarantine, restore from clean source, remove injected rows, rotate secrets, remove rogue admins, disable scheduled tasks, and harden configuration.

### 7.3 Enterprise Management

- Support tenants, organizations, sites, environments, and cases.
- Provide centralized dashboard across many sites.
- Provide REST API and CLI.
- Provide desktop triage application for offline evidence bundles and local review.
- Integrate with SSO, SCIM, SIEM, ticketing, object storage, S3-compatible evidence storage, and STIX/TAXII.
- Provide RBAC, audit logs, signed updates, license enforcement, and offline deployments.

## 8. Non-Functional Requirements

### 8.1 Security

- Zero trust toward scanned WordPress runtimes.
- Least privilege agents.
- Signed rule packs and signed engine updates.
- End-to-end evidence integrity.
- Tenant isolation.
- Encryption in transit and at rest.
- Secret redaction and sensitive-data minimization.
- Sandboxed analyzers.
- Reproducible scan results.

### 8.2 Reliability

- Scans must be resumable.
- Partial results must be preserved.
- Agent crashes must not break WordPress.
- Remediation must be transactional where possible.
- Evidence capture must happen before destructive actions.
- Queues must provide at-least-once processing with idempotent task handlers.

### 8.3 Performance

- Incremental scans must avoid reprocessing unchanged files.
- Heavy analysis must be offloaded from production WordPress where possible.
- Parallelism must be bounded by CPU, memory, I/O, and database load budgets.
- Default scan mode must be safe for shared hosting.
- Deep forensic mode may use more resources with explicit operator approval.

### 8.4 Privacy

- Default cloud telemetry contains detector IDs, normalized metadata, hashes, versions, and risk summaries, not raw customer source or database content.
- Raw samples require explicit user permission, policy exception, or private deployment.
- PII detection and redaction must exist for logs, reports, and evidence exports.

### 8.5 Compliance

- Support SOC 2 style auditability.
- Support GDPR data deletion workflows.
- Support enterprise retention policies.
- Support legal hold for evidence.
- Support immutable audit logging.

## 9. Threat Model

### 9.1 Protected Assets

- WordPress filesystem.
- Database.
- wp-config.php secrets.
- Authentication cookies and salts.
- Admin accounts.
- Plugin and theme source.
- Customer content and PII.
- Backups.
- Evidence bundles.
- Detection rules.
- Threat intelligence feeds.
- License keys.
- Cloud control plane.
- Agents and update channels.

### 9.2 Adversaries

- Commodity botnets exploiting known plugin vulnerabilities.
- Human operators deploying web shells.
- SEO spam operators.
- Credit-card skimmer operators.
- Phishing kit operators.
- Supply-chain attackers.
- Malicious insiders.
- Compromised hosting accounts.
- Malware authors attempting scanner evasion.
- Attackers targeting the security platform itself.

### 9.3 Attack Surfaces

- WordPress plugin agent.
- Local scanner agent.
- REST API.
- Web dashboard.
- Desktop app.
- Rule update channel.
- Sandbox execution environment.
- Evidence upload endpoint.
- Third-party feed ingestion.
- Remediation execution.
- Report generation.

### 9.4 Key Threats and Controls

- Tampered agent: signed binaries, self-integrity checks, remote attestation where available, least privilege, and server-side trust evaluation.
- Scanner evasion: out-of-process scanning, direct filesystem reads, raw database queries, decoded-layer scanning, sandboxing, and randomized analysis profiles.
- Malicious rule pack: signed rules, staged rollout, rule linting, constrained DSL, canary testing, and rollback.
- Cross-tenant data leak: tenant-scoped encryption keys, row-level access controls, separate object prefixes, access checks in service layer, and automated authorization tests.
- Evidence tampering: content-addressed storage, cryptographic hashes, append-only logs, timestamping, and chain-of-custody records.
- Destructive remediation: preflight checks, backups, dry runs, reversible operations, approval gates, and post-remediation verification.
- Compromised cloud control plane: hardware-backed keys, separation of duties, audit trails, just-in-time admin access, and immutable logs.

## 10. Architecture Overview

### 10.1 High-Level Components

- Site Agent: lightweight WordPress plugin and optional host-side agent for data collection, local integrity checks, safe remediation, and status reporting.
- Scan Orchestrator: schedules scans, assigns tasks, manages budgets, retries, and scan state.
- Evidence Collector: acquires files, database snapshots, logs, HTTP responses, and environment metadata.
- Analysis Pipeline: normalizes artifacts, parses languages, applies detection engines, builds graphs, and generates findings.
- Forensic Platform: stores evidence, timelines, incident graphs, chain-of-custody, cases, and reports.
- Intelligence Platform: ingests vulnerabilities, IOCs, plugin/theme metadata, reputation signals, signatures, YARA, and research outputs.
- Remediation Planner: converts findings into reversible remediation plans.
- Policy and Rule Engine: evaluates rules, customer policies, suppressions, risk models, and response automation.
- User Interfaces: dashboard, REST API, CLI, desktop app.
- Enterprise Services: auth, RBAC, audit, licensing, updates, telemetry, monitoring, billing, and deployment management.

### 10.2 Reference Data Flow

1. Agent registers site with tenant-scoped identity.
2. Orchestrator schedules a scan profile.
3. Evidence Collector captures manifest, changed files, database samples, logs, and HTTP probes.
4. Artifacts are hashed, deduplicated, encrypted, and stored.
5. Pipeline stages classify artifacts and route them to analyzers.
6. PHP/JS/HTML/database analyzers emit observations.
7. Detection engines emit normalized finding candidates.
8. Correlator merges evidence into incidents and campaigns.
9. Risk scorer assigns site, asset, incident, and finding scores.
10. Remediation Planner generates dry-run and executable plans.
11. UI/API presents explainable findings and approval workflows.
12. If approved, agent executes remediation and verification scan.

## 11. Architectural Decisions

### ADR-001: Hybrid Agent and Cloud/Server Analysis

- Decision: Use a lightweight WordPress plugin for easy onboarding plus an optional host-side agent and external orchestrator for high-assurance analysis.
- Alternatives: plugin-only; cloud-only remote crawl; host-agent-only.
- Trade-offs: plugin-only is easy but untrusted during compromise; remote crawl misses server-side persistence; host agent has stronger access but harder deployment.
- Reasoning: Hybrid mode covers small sites and enterprises while supporting forensic trust boundaries.

### ADR-002: Rust or Go for Core Scanner, TypeScript for UI, Python for Research Tooling

- Decision: Build the performance-critical scanner and parsers in Rust or Go, UI in TypeScript, and research workflows in Python notebooks/services.
- Alternatives: PHP scanner; all-Python; JVM; C++.
- Trade-offs: Rust offers memory safety and performance but higher development cost; Go offers operational simplicity but weaker parser ecosystem for some compiler tasks; PHP integration is easy but unsafe for deep scanning.
- Reasoning: Malware scanners process hostile input and need memory safety, concurrency, and static binaries.

### ADR-003: Tree-sitter and Dedicated Parsers

- Decision: Use proven parsers such as tree-sitter where mature, supplemented by PHP-specific AST tooling and custom tolerant parsers for malformed malware.
- Alternatives: regex-only; invoke PHP runtime parser; fully custom parser.
- Trade-offs: tolerant parsers handle broken code; runtime parsers provide exact PHP semantics but may execute risky autoload behavior if used carelessly; custom parsers are expensive.
- Reasoning: WordPress malware is often syntactically weird but still must be analyzed safely.

### ADR-004: Multi-Engine Detection

- Decision: Combine signatures, YARA, semantic signatures, AST patterns, heuristics, ML, IOCs, integrity checks, and behavioral analysis.
- Alternatives: signature-only; ML-first; integrity-only.
- Trade-offs: multi-engine systems require calibration and conflict resolution; single-engine systems are simpler but brittle.
- Reasoning: WordPress malware varies from known commodity payloads to heavily obfuscated custom persistence.

### ADR-005: Evidence-First Remediation

- Decision: Preserve evidence before cleanup and produce reversible remediation plans.
- Alternatives: immediate cleanup; manual-only reports.
- Trade-offs: evidence-first adds storage and latency; immediate cleanup is faster but destroys context.
- Reasoning: Enterprise incident response requires defensible evidence and root cause analysis.

### ADR-006: PostgreSQL, Object Storage, Search Index, Graph Store

- Decision: Use PostgreSQL for transactional metadata, object storage for evidence, OpenSearch-compatible indexing for search, and either PostgreSQL graph extensions or a dedicated graph database for incident graphs at scale.
- Alternatives: single relational database; document database; graph-only database.
- Trade-offs: polyglot persistence increases operations complexity; single-store designs reduce specialized capability.
- Reasoning: evidence, search, relational tenancy, and correlation graphs have different access patterns.

### ADR-007: STIX/TAXII and CycloneDX Interoperability

- Decision: Support STIX/TAXII for threat intel exchange and CycloneDX for component inventory/SBOM/VEX-style vulnerability context.
- Alternatives: proprietary-only formats; CSV feeds.
- Trade-offs: standards impose mapping complexity; proprietary formats can move faster.
- Reasoning: Enterprise buyers expect interoperability with CTI and supply-chain tooling.

### ADR-008: Policy-as-Code

- Decision: Provide a constrained policy engine for scan profiles, remediation approvals, suppressions, and enterprise controls.
- Alternatives: hard-coded settings; arbitrary scripting.
- Trade-offs: constrained DSL limits flexibility but is safer; arbitrary scripts are powerful but dangerous.
- Reasoning: Security automation must be auditable and sandboxed.

### ADR-009: AI as Triage and Scoring, Not Autonomous Authority

- Decision: Use AI models for classification, clustering, deobfuscation hints, natural-language explanation, and triage prioritization, but require deterministic evidence for high-confidence action.
- Alternatives: no AI; AI-first autonomous cleanup.
- Trade-offs: AI improves unknown detection and analyst speed but introduces drift and explainability risk.
- Reasoning: Enterprise remediation requires reproducible evidence.

### ADR-010: Signed Update and Rule Supply Chain

- Decision: All engines, rules, signatures, models, and remediation scripts must be signed, versioned, staged, and rollback-capable.
- Alternatives: unsigned auto-update; manual updates only.
- Trade-offs: signing adds infrastructure and operational discipline; unsigned updates are unacceptable for security software.
- Reasoning: The platform update channel is a high-value attacker target.

## 12. Domain Model

Core entities:

- Tenant: enterprise customer boundary.
- Organization: administrative grouping inside a tenant.
- Site: WordPress installation or multisite network.
- Environment: production, staging, development, disaster recovery, or custom.
- Agent: registered collector/remediator identity.
- Scan: execution instance with profile, scope, budget, and result.
- Artifact: file, database row, log segment, HTTP response, archive member, decoded payload, or memory-like sandbox output.
- Observation: normalized low-level fact emitted by analyzers.
- Finding: security-relevant conclusion with evidence and confidence.
- Incident: correlated set of findings representing one compromise or campaign.
- Case: analyst-managed investigation container.
- Evidence Item: immutable stored artifact with chain-of-custody.
- Rule Pack: signed set of detection or policy rules.
- Remediation Plan: ordered graph of proposed actions.
- Action: executable remediation step.
- Suppression: scoped exception with expiration and justification.
- Intelligence Object: vulnerability, IOC, malware family, campaign, plugin reputation, theme reputation, or actor profile.

## 13. Common Module Contract

Every analysis module must implement the following conceptual interface:

- Input: artifact references, scan context, tenant policy, resource budget, dependency handles, and prior observations.
- Output: observations, findings, derived artifacts, metrics, errors, and explainability records.
- Determinism: same inputs and same rule/model versions must produce equivalent outputs.
- Provenance: every output must record module name, version, rule/model IDs, timestamp, input artifact IDs, and confidence.
- Failure behavior: module errors must degrade gracefully and never abort the entire scan unless the artifact is central to scan integrity.
- Resource controls: CPU, memory, wall time, recursion depth, decoded-layer count, and output volume must be bounded.
- Security: modules process hostile content in sandboxed or memory-safe contexts and must never execute customer code except inside explicit dynamic sandbox profiles.
- Testing: each module requires unit tests, corpus tests, fuzz tests for parsers/decoders, regression tests for malware samples, and performance tests.

## 14. Module Decomposition

### M01. Site Agent

Responsibilities:

- Register sites and maintain tenant-bound identity.
- Enumerate filesystem and database metadata.
- Execute safe local collection and remediation commands.
- Report health, versions, scan progress, and errors.
- Enforce scan resource budgets.

Interfaces:

- Agent Control API: register, heartbeat, get tasks, report task result.
- Local WordPress Adapter: read options, users, roles, cron, plugins, themes, versions.
- Filesystem Adapter: hash, read, quarantine, restore, chmod, stat.
- Database Adapter: snapshot selected tables, stream rows, patch rows transactionally.

Algorithms:

- Incremental manifest generation using path, size, mtime, inode/file ID where available, SHA-256, and fast rolling hashes.
- Adaptive chunking for large files.
- Backoff and retry for API communication.
- Idempotent task execution using task IDs and action fingerprints.

Data structures:

- FileManifestEntry(path, size, mtime, mode, owner, sha256, quick_hash, wp_component_hint).
- DbTableManifest(table, row_count_estimate, checksum_sample, schema_hash).
- AgentTask(task_id, type, scope, budget, preconditions).

Dependencies:

- WordPress APIs for low-risk metadata.
- Direct filesystem and database access where available.
- TLS client.
- Local secure storage.

Failure modes:

- WordPress runtime compromised.
- Insufficient permissions.
- Timeout on shared hosting.
- Database connection errors.
- Partial file reads.
- Network outage.

Complexity:

- Manifest scan O(n files + m rows sampled).
- Hashing O(total bytes read).
- Memory O(batch size).

Security:

- Least privilege.
- No arbitrary server-side code execution from cloud.
- Command allowlist.
- Signed task envelopes.
- mTLS where possible.
- Secrets never logged.

Scalability:

- Supports streaming uploads and resumable chunks.
- Batches database rows.
- Uses local cache for unchanged artifacts.

Testing:

- WordPress version matrix.
- Shared-hosting permission simulations.
- Compromised API hook simulations.
- Interrupted task recovery.
- Remediation dry-run tests.

### M02. Scan Orchestrator

Responsibilities:

- Schedule and coordinate scans.
- Assign tasks to agents and workers.
- Enforce concurrency, budgets, priorities, and tenant limits.
- Resume interrupted scans.
- Maintain scan state machine.

Interfaces:

- REST/gRPC internal scheduling API.
- Queue producer/consumer interface.
- Agent task API.
- Worker lease API.

Algorithms:

- Priority queue scheduling by risk, SLA, tenant quota, and scan age.
- Work stealing for artifact analysis.
- Idempotent task leasing with visibility timeout.
- DAG execution for dependent stages.

Data structures:

- ScanDAG(nodes, edges, state).
- WorkItem(id, artifact_id, analyzer, priority, lease_expiry).
- Budget(cpu_seconds, memory_mb, io_bytes, db_rows, wall_time).

Dependencies:

- PostgreSQL.
- Message queue such as NATS, RabbitMQ, Kafka, or cloud queue.
- Distributed lock service where required.

Failure modes:

- Duplicate task execution.
- Queue backlog.
- Worker crash.
- Tenant quota exhaustion.
- Stale leases.

Complexity:

- Scheduling O(log q) per task with priority queue.
- DAG traversal O(V + E).

Security:

- Tenant-scoped scheduling.
- Server-side authorization on every task.
- No cross-tenant worker access without policy.

Scalability:

- Horizontal worker scaling.
- Partition queues by tenant tier and task class.
- Backpressure from storage and databases.

Testing:

- State machine tests.
- Chaos tests for worker crashes.
- Queue redelivery tests.
- Quota and fairness tests.

### M03. Evidence Collector

Responsibilities:

- Capture immutable raw evidence.
- Create normalized derived artifacts.
- Preserve chain of custody.
- Deduplicate and encrypt evidence.

Interfaces:

- Artifact ingestion API.
- Object storage API.
- Chain-of-custody API.
- Evidence export API.

Algorithms:

- Content-addressed storage by SHA-256 or BLAKE3 plus tenant salt for lookup privacy.
- Merkle tree manifests for directory snapshots.
- Streaming compression and encryption.
- Evidence acquisition ordering: metadata, hash, content, verification hash.

Data structures:

- EvidenceItem(id, tenant_id, artifact_type, hash, size, storage_uri, encryption_key_id, acquired_by, acquired_at).
- CustodyEvent(evidence_id, actor, action, timestamp, reason, previous_hash, event_hash).
- MerkleNode(path, hash, children_hash).

Dependencies:

- Object storage.
- KMS or HSM.
- PostgreSQL.
- Optional timestamping authority.

Failure modes:

- Partial uploads.
- Hash mismatch.
- Object storage outage.
- KMS unavailable.
- Evidence volume explosion.

Complexity:

- Evidence hashing O(bytes).
- Merkle tree construction O(n log n) depending sort strategy, O(n) after sorted traversal.

Security:

- Encryption before or during upload.
- Immutable bucket policies.
- Legal hold support.
- Strict export authorization.

Scalability:

- Deduplicate identical artifacts.
- Tier cold evidence to cheaper storage.
- Stream large archives.

Testing:

- Tamper detection tests.
- Interrupted upload recovery.
- Chain hash verification.
- Legal hold retention tests.

### M04. File Scanning Engine

Responsibilities:

- Classify files.
- Route files to analyzers.
- Detect suspicious metadata and content.
- Maintain incremental scan cache.

Interfaces:

- Artifact classification API.
- Analyzer routing API.
- Scan cache API.

Algorithms:

- Magic-byte and extension classification.
- Entropy analysis.
- N-gram feature extraction.
- Fuzzy hashing with ssdeep/TLSH-style algorithms.
- Archive traversal with recursion and bomb protection.
- Component mapping to WordPress core/plugin/theme manifests.

Data structures:

- FileTypeResult(mime, language, confidence).
- ScanCacheKey(hash, analyzer_version, rule_pack_version).
- FileFeatureVector(size, entropy, strings, tokens, permissions, path_features).

Dependencies:

- libmagic-equivalent.
- Archive readers.
- Fuzzy hash library.
- Component manifest store.

Failure modes:

- Zip bombs.
- Truncated files.
- Encoding ambiguity.
- Huge minified assets.
- Permission denied.

Complexity:

- O(bytes) per file for hashing and feature extraction.
- Archive complexity bounded by configured decompressed size and entry count.

Security:

- Never trust file extension.
- Sandbox archive extraction.
- Enforce decompression ratio limits.
- Treat symlinks and path traversal carefully.

Scalability:

- Parallel file batches.
- Skip unchanged files by cache.
- Prioritize executable paths and recently changed files.

Testing:

- Malware corpus.
- Benign WordPress corpus.
- Archive bomb tests.
- Polyglot file tests.

### M05. PHP Parser

Responsibilities:

- Parse PHP into concrete syntax tree and AST.
- Recover from malformed or obfuscated PHP.
- Preserve source spans and comments.
- Extract embedded HTML, strings, and eval-like code.

Interfaces:

- parse_php(artifact_id, bytes, php_version_hint) -> ParseResult.
- normalize_php_ast(ast, options) -> NormalizedAST.
- extract_embedded_payloads(ast) -> DerivedArtifacts.

Algorithms:

- Tolerant parsing with error nodes.
- Token stream normalization.
- AST canonicalization.
- Constant folding for literals.
- String interpolation expansion.
- Heredoc/nowdoc extraction.

Data structures:

- Token(kind, text_hash, span).
- ASTNode(kind, children, attributes, span).
- ParseError(code, span, recoverable).
- SourceMap(original_span, normalized_span).

Dependencies:

- Mature PHP parser where possible.
- Custom tolerant layer for malware.
- PHP version compatibility grammar.

Failure modes:

- Unsupported PHP syntax.
- Deliberately malformed code.
- Encoding confusion.
- Extremely deep nesting.

Complexity:

- Expected O(tokens).
- Worst-case bounded by parser recursion and timeout limits.

Security:

- Parser must not execute PHP.
- Memory-safe implementation preferred.
- Recursion and node-count limits.

Scalability:

- AST cache by file hash and parser version.
- Parse only changed files.

Testing:

- PHP version syntax suite.
- WordPress core/plugin/theme corpus.
- Malware obfuscation corpus.
- Grammar fuzzing.

### M06. AST Analysis Engine

Responsibilities:

- Detect semantic PHP malware patterns.
- Produce normalized semantic observations.
- Feed CFG, DFG, taint, symbolic execution, and signature engines.

Interfaces:

- analyze_ast(ast, context) -> observations/findings.
- query_ast(pattern) -> matches.
- emit_semantic_facts(ast) -> fact table.

Algorithms:

- AST pattern matching.
- Canonical subtree hashing.
- Semantic normalization of aliases and namespace imports.
- Dangerous API detection.
- Hook registration analysis.
- WordPress-specific API recognition.

Data structures:

- SemanticFact(predicate, subject, object, span).
- ASTSubtreeHash(kind_hash, structure_hash, literal_policy).
- HookRegistration(hook, callback, priority, accepted_args, span).

Dependencies:

- PHP parser output.
- WordPress API model.
- Detection rule DSL.

Failure modes:

- Dynamic function names.
- Variable variables.
- Runtime includes.
- Missing dependency files.

Complexity:

- O(AST nodes * active pattern cost).
- Indexed patterns reduce common cases to O(nodes).

Security:

- Rule DSL is sandboxed.
- Avoid catastrophic pattern backtracking.

Scalability:

- Pre-index AST nodes by kind and symbol.
- Cache semantic facts.

Testing:

- Pattern unit tests.
- Hook detection fixtures.
- Benign custom-code fixtures.
- Obfuscated malware fixtures.

### M07. CFG Generation

Responsibilities:

- Build intraprocedural and selected interprocedural control-flow graphs.
- Model PHP constructs, exceptions, includes, closures, callbacks, and WordPress hooks.
- Feed taint and symbolic execution engines.

Interfaces:

- build_cfg(function_or_file_ast, options) -> CFG.
- build_call_graph(site_context) -> CallGraph.

Algorithms:

- Basic block construction.
- Edge creation for conditionals, loops, try/catch/finally, return, throw, include, and dynamic dispatch approximations.
- Call graph construction using resolved symbols and conservative dynamic call edges.
- WordPress hook graph overlay.

Data structures:

- BasicBlock(id, statements, span).
- CFGEdge(from, to, type, condition).
- FunctionSummary(symbol, params, returns, side_effects).
- HookGraph(hook -> callbacks).

Dependencies:

- AST semantic facts.
- Symbol table.
- WordPress hook model.

Failure modes:

- Unresolved dynamic includes.
- Dynamic callbacks.
- Extremely large generated code.

Complexity:

- CFG O(statements + edges).
- Call graph O(call sites * candidate resolution cost).

Security:

- No code execution.
- Conservative modeling for unknown flows.

Scalability:

- Build deep CFG only for executable/suspicious files.
- Summarize known libraries and WordPress core.

Testing:

- CFG golden tests.
- WordPress hook callback tests.
- Dynamic call approximation tests.

### M08. DFG Generation

Responsibilities:

- Build data-flow graph for variables, globals, arrays, object properties, superglobals, database reads/writes, and WordPress options.
- Support taint and root-cause analysis.

Interfaces:

- build_dfg(cfg, ast, symbol_table) -> DFG.
- summarize_data_flow(function) -> FunctionDataFlowSummary.

Algorithms:

- Reaching definitions.
- Use-def chains.
- SSA-like normalization for local variables where practical.
- Field-sensitive analysis for simple arrays/objects.
- Context-sensitive summaries for high-value functions.

Data structures:

- DataNode(id, kind, symbol, span).
- DataEdge(from, to, relation, condition).
- Definition(symbol, value_origin, span).
- Summary(source_params, sink_params, return_taint, side_effects).

Dependencies:

- CFG.
- AST.
- Type/symbol resolver.

Failure modes:

- Dynamic variable names.
- Reflection.
- Runtime-generated code.
- Aliasing ambiguity.

Complexity:

- Intraprocedural dataflow O(edges * lattice_height).
- Interprocedural analysis bounded by call depth and summary cache.

Security:

- Treat unknown dynamic flows conservatively.
- Bound graph sizes.

Scalability:

- Demand-driven DFG for suspicious functions.
- Cache summaries by content hash.

Testing:

- Use-def fixtures.
- Superglobal flow fixtures.
- Database option flow fixtures.
- Large plugin performance tests.

### M09. Taint Analysis Engine

Responsibilities:

- Track untrusted inputs to dangerous sinks.
- Detect backdoors, upload abuse, command execution, SQL injection-like malware, and stored script injection.
- Explain source-to-sink paths.

Interfaces:

- run_taint(site_program_model, policy) -> TaintResults.
- get_taint_path(finding_id) -> graph path.

Algorithms:

- Forward taint propagation across DFG.
- Sanitizer and validator modeling.
- Source, sanitizer, propagator, and sink rule evaluation.
- Interprocedural summary application.
- WordPress-specific source/sink modeling.

Data structures:

- TaintLabel(kind, source, confidence).
- TaintState(variable -> label set).
- TaintPath(nodes, edges, sanitizers, gaps).
- SourceSinkRule(id, source_pattern, sink_pattern, sanitizers).

Dependencies:

- DFG.
- CFG.
- WordPress API model.
- Rule engine.

Failure modes:

- Path explosion.
- Missing sanitizer models.
- Overtainting.
- Undertainting dynamic code.

Complexity:

- O(dataflow_edges * label_count) with bounds.
- Path reconstruction O(path length).

Security:

- Conservative unknown calls.
- Findings must state uncertainty.

Scalability:

- Prioritize files with dangerous sinks or recent modification.
- Use summaries for libraries.

Testing:

- SAST benchmark tests.
- WordPress custom plugin fixtures.
- Malware shell upload fixtures.
- False-positive regression suite.

### M10. Symbolic Execution Engine

Responsibilities:

- Explore suspicious PHP paths to prove reachability of dangerous behavior under constraints.
- Recover trigger conditions for web shells and backdoors.
- Generate explainable exploitability evidence without executing code in production.

Interfaces:

- symbolic_execute(cfg_slice, bounds, models) -> SymbolicResult.
- solve_trigger_conditions(path) -> ConditionSet.

Algorithms:

- Path-sensitive symbolic execution over bounded CFG slices.
- Constraint solving with SMT where practical.
- String constraint approximation.
- Environment and WordPress API modeling.
- Path prioritization based on suspicious sinks.

Data structures:

- SymbolicState(env, heap_model, path_conditions, taint_labels).
- Constraint(kind, expression, span).
- ExecutionPath(blocks, constraints, sink_reached).

Dependencies:

- CFG/DFG.
- SMT solver such as Z3 where licensed and deployable.
- Function models.

Failure modes:

- Path explosion.
- Unsupported PHP semantics.
- Solver timeout.
- String constraints too complex.

Complexity:

- Exponential in paths, bounded by depth, time, and branch limits.

Security:

- No runtime execution.
- Model external calls instead of invoking them.

Scalability:

- Run only on high-risk slices.
- Cache function summaries and solved constraints.

Testing:

- Trigger condition golden tests.
- Solver timeout tests.
- Known web shell path tests.

### M11. Deobfuscation Engine

Responsibilities:

- Decode layered PHP, JavaScript, HTML, and data payloads.
- Extract derived artifacts for rescanning.
- Explain transformation chains.

Interfaces:

- deobfuscate(artifact, language_hint, budget) -> DecodeGraph.
- register_decoder(decoder_plugin).

Algorithms:

- Base64, hex, octal, URL, HTML entity, gzip, zlib, ROT, XOR, char-code, string reversal, concatenation folding, array join folding.
- PHP literal evaluation without executing functions.
- JavaScript AST constant folding and string array resolver.
- Eval-chain extraction.
- Entropy-driven candidate detection.
- Beam search over decode operations with budget.

Data structures:

- DecodeNode(artifact_id, transform, parent_id, confidence, depth).
- DecodeEdge(operation, parameters, evidence_span).
- DecoderCandidate(span, encoding_guess, score).

Dependencies:

- PHP parser.
- JS parser.
- Compression libraries.
- Rule engine.

Failure modes:

- Infinite decode chains.
- Malicious decompression.
- False decode candidates.
- Payload requires runtime values.

Complexity:

- O(candidates * transforms * bytes) bounded by depth and output size.

Security:

- Never execute decoded code on host.
- Enforce decompression limits.
- Preserve original and derived evidence.

Scalability:

- Decode only high-entropy or suspicious regions first.
- Cache decoded artifacts by hash and transform chain.

Testing:

- Obfuscation corpus.
- Nested payload tests.
- Decompression bomb tests.
- Benign minified asset tests.

### M12. Malware Signature Engine

Responsibilities:

- Match known malware families, variants, and semantic patterns.
- Support exact, fuzzy, token, AST, and graph signatures.

Interfaces:

- match_signatures(artifact, normalized_views) -> SignatureMatches.
- compile_signature_pack(pack) -> compiled index.

Algorithms:

- Aho-Corasick for multi-string search.
- Regex with safe engines and timeouts.
- Token sequence matching.
- AST subtree hashing.
- Fuzzy hash similarity.
- Semantic fact pattern matching.

Data structures:

- Signature(id, family, severity, pattern_type, pattern, conditions, metadata).
- Match(signature_id, span, evidence, confidence).
- CompiledStringAutomaton.

Dependencies:

- Rule repository.
- Parser normalized views.
- Safe regex engine.

Failure modes:

- Catastrophic regex if unsafe engine used.
- False positives on security tools or backups.
- Rule conflicts.

Complexity:

- String matching O(bytes + matches).
- AST matching O(nodes) with indexes.

Security:

- Signed rule packs.
- Rule linting and sandboxed evaluation.
- No unbounded regex.

Scalability:

- Compile rules once per version.
- Shard rules by language and artifact type.

Testing:

- Known malware corpus.
- Benign corpus.
- Rule mutation tests.
- Performance tests with large files.

### M13. YARA Engine

Responsibilities:

- Execute YARA rules against raw files, decoded payloads, extracted strings, and normalized code.
- Import external and internal YARA packs.

Interfaces:

- scan_yara(artifact, rule_set, timeout) -> YaraMatches.
- validate_yara_pack(pack) -> validation report.

Algorithms:

- Native YARA compiled rule execution.
- Rule metadata normalization.
- Namespace isolation by rule source.
- Timeout and memory guard execution.

Data structures:

- YaraRuleMetadata(family, author, source, confidence, tags).
- YaraMatch(rule, strings, offsets, namespace).

Dependencies:

- libyara or compatible engine.
- Rule signing infrastructure.

Failure modes:

- Slow rules.
- Rules with broad false positives.
- Unsupported modules.

Complexity:

- Depends on compiled YARA rules and file size, practically O(bytes * selected rule cost).

Security:

- Disable dangerous modules unless explicitly approved.
- Signed packs.
- Run in worker sandbox for untrusted external rules.

Scalability:

- Precompile rule sets.
- Route by file type and size.

Testing:

- Rule validation.
- Timeout tests.
- Third-party pack compatibility.
- False-positive corpus.

### M14. Heuristic Engine

Responsibilities:

- Detect suspicious behavior patterns not covered by signatures.
- Produce calibrated features for risk scoring and AI.

Interfaces:

- evaluate_heuristics(artifact_features, semantic_facts) -> HeuristicFindings.

Algorithms:

- Weighted rule scoring.
- Anomaly detection against WordPress path/component baselines.
- Feature combinations such as high entropy plus eval plus recent mtime plus writable plugin path.
- Path rarity scoring.
- Suspicious permission and ownership scoring.

Data structures:

- HeuristicFeature(name, value, source).
- HeuristicRule(id, condition, weight, explanation).
- HeuristicScore(score, contributing_features).

Dependencies:

- File scanning features.
- AST facts.
- Integrity data.
- Site baseline.

Failure modes:

- False positives in custom plugins.
- Drift after site updates.
- Sparse baseline for new sites.

Complexity:

- O(features + rules) with indexed rule predicates.

Security:

- Heuristics cannot trigger destructive remediation alone unless policy permits and confidence is high.

Scalability:

- Precompute common features.
- Batch rule evaluation.

Testing:

- Calibration datasets.
- False-positive review workflow.
- A/B rule testing.

### M15. AI Detection Engine

Responsibilities:

- Classify suspicious artifacts and clusters.
- Assist triage and explanation.
- Detect unknown malware families by learned features.
- Cluster related campaigns.

Interfaces:

- score_artifact(features, normalized_code, metadata) -> AIScore.
- explain_ai_score(score_id) -> explanation.
- cluster_samples(sample_set) -> clusters.

Algorithms:

- Gradient-boosted trees over engineered features for robust tabular classification.
- Transformer/code model embeddings for semantic similarity where privacy permits.
- One-class or isolation forest models for anomaly detection per component/site cohort.
- Clustering using approximate nearest neighbor search over embeddings.
- Model calibration with reliability curves.

Data structures:

- FeatureVector(version, values, missingness).
- ModelScore(model_id, probability, calibration_bucket, top_features).
- Embedding(vector, model_id, artifact_hash).

Dependencies:

- Feature store.
- Model registry.
- Training corpus.
- Privacy and consent controls.

Failure modes:

- Model drift.
- Adversarial examples.
- Training data bias.
- Poor explainability.
- Privacy leakage.

Complexity:

- Tree model inference O(trees * depth).
- Embedding inference O(model size * tokens).
- ANN search roughly O(log n) to sublinear depending index.

Security:

- AI cannot be sole evidence for severe findings.
- Models and prompts are signed/versioned.
- Raw source sent to cloud models only with explicit policy.

Scalability:

- Batch inference.
- Cache embeddings by normalized content hash.
- Use local models for private deployments.

Testing:

- Train/validation/test split by malware family and time.
- Drift monitoring.
- Adversarial obfuscation tests.
- Calibration tests.
- Human analyst review loops.

### M16. IOC Engine

Responsibilities:

- Extract, normalize, enrich, and match IOCs.
- Support campaign correlation and threat intelligence.

Interfaces:

- extract_iocs(artifact) -> IOCObservations.
- match_iocs(iocs, feeds) -> IOCMatches.

Algorithms:

- Regex and parser-based extraction for URLs, domains, IPs, hashes, email addresses, cryptocurrency wallets, user agents, paths, and registry-like tokens.
- URL canonicalization.
- Domain punycode normalization.
- Public suffix processing.
- Reputation and feed matching.

Data structures:

- IOC(type, value, normalized_value, source_span, confidence).
- IOCMatch(ioc_id, feed_id, first_seen, last_seen, labels).

Dependencies:

- Public suffix list.
- Threat feeds.
- DNS/reputation providers where configured.

Failure modes:

- Defanged IOCs.
- Benign references in comments.
- Homograph domains.
- Feed false positives.

Complexity:

- Extraction O(bytes).
- Matching O(iocs * lookup cost), usually O(1) hash lookups.

Security:

- Do not beacon to suspicious domains during enrichment.
- Use passive DNS or controlled resolver.

Scalability:

- Bloom filters for large IOC sets.
- Batch enrichment.

Testing:

- Defanged IOC tests.
- URL canonicalization tests.
- Feed conflict tests.

### M17. Threat Intelligence Platform

Responsibilities:

- Ingest, normalize, score, and distribute threat intelligence.
- Manage malware families, campaigns, IOCs, signatures, rules, and relationships.

Interfaces:

- STIX/TAXII import/export.
- Internal Intel API.
- Rule publishing workflow.
- Analyst curation UI.

Algorithms:

- Feed deduplication.
- Confidence decay over time.
- Source reliability scoring.
- Entity resolution across IOCs, hashes, families, and campaigns.
- Graph correlation.

Data structures:

- IntelObject(type, value, confidence, source, valid_from, valid_until).
- IntelRelationship(source_id, relation, target_id, confidence).
- FeedSource(reliability, license, retention_policy).

Dependencies:

- CTI feeds.
- Analyst tooling.
- Graph store.
- Rule signing.

Failure modes:

- Poisoned feeds.
- Duplicate objects.
- Stale indicators.
- Licensing conflicts.

Complexity:

- Ingestion O(feed objects).
- Entity resolution can be O(n log n) with indexes, worse for fuzzy matching.

Security:

- Feed provenance and trust scoring.
- Quarantine untrusted feeds.
- Human approval for high-impact rules.

Scalability:

- Partition by intel type and feed.
- Stream processing for large feeds.

Testing:

- STIX/TAXII conformance.
- Feed poisoning simulations.
- Confidence decay tests.

### M18. Vulnerability Intelligence

Responsibilities:

- Track WordPress core, plugin, and theme vulnerabilities.
- Map installed components to vulnerabilities.
- Estimate exploitability and relevance.

Interfaces:

- ingest_vulnerability(source).
- match_site_components(site_inventory) -> vulnerability findings.
- export_vex_status(component).

Algorithms:

- Package identity normalization.
- Version range evaluation.
- CVSS/EPSS/vendor severity ingestion.
- Exploit maturity scoring.
- Reachability/context scoring using installed status, active status, exposed endpoints, and observed indicators.

Data structures:

- Vulnerability(id, aliases, affected_ranges, fixed_versions, severity, exploit_status).
- ComponentIdentity(slug, vendor, version, source, hash).
- ExposureContext(active, network_reachable, role_required, exploit_seen).

Dependencies:

- WordPress.org APIs where permitted.
- WPScan-like data sources or licensed feeds.
- NVD and vendor advisories.
- Internal research.

Failure modes:

- Incorrect version parsing.
- Plugin fork identity ambiguity.
- Missing advisories.
- False exploitability assumptions.

Complexity:

- Matching O(components * vulnerabilities for component), optimized by component index.

Security:

- Licensed feed handling.
- Avoid leaking customer inventory without permission.

Scalability:

- Pre-index version ranges.
- Cache common component matches.

Testing:

- Version range fixtures.
- Forked plugin tests.
- Exploitability scoring validation.

### M19. Plugin Intelligence

Responsibilities:

- Understand plugin provenance, reputation, version history, maintainer signals, file manifests, hooks, capabilities, endpoints, and risk.

Interfaces:

- analyze_plugin(component_artifacts) -> PluginProfile.
- compare_plugin_to_known_manifest(profile) -> drift report.

Algorithms:

- Slug and header extraction.
- Manifest comparison.
- Hook and REST route extraction.
- Capability and nonce usage analysis.
- Maintainer/repository reputation scoring.
- Abandonment and update anomaly detection.

Data structures:

- PluginProfile(slug, version, files, hooks, routes, capabilities, external_calls, risk).
- ComponentDrift(missing_files, modified_files, extra_files).

Dependencies:

- WordPress plugin repository metadata.
- Vulnerability intelligence.
- AST analysis.

Failure modes:

- Custom/private plugins.
- Forked plugins.
- Obfuscated commercial plugins.

Complexity:

- O(plugin files + AST nodes analyzed).

Security:

- Do not treat repository presence as safety.
- Commercial plugin source must remain tenant-private.

Scalability:

- Cache profiles by component hash.
- Share public plugin manifests globally.

Testing:

- Public plugin corpus.
- Private plugin fixtures.
- Drift detection tests.

### M20. Theme Intelligence

Responsibilities:

- Analyze theme provenance, templates, functions.php, injected template code, footer/header spam, and suspicious assets.

Interfaces:

- analyze_theme(component_artifacts) -> ThemeProfile.

Algorithms:

- Theme header extraction.
- Template include graph.
- Hook extraction.
- External resource and inline script analysis.
- Known manifest comparison.

Data structures:

- ThemeProfile(slug, version, templates, hooks, external_resources, drift, risk).

Dependencies:

- WordPress theme repository metadata.
- HTML/JS/PHP analyzers.

Failure modes:

- Child theme customizations.
- Page builder generated code.
- Minified bundled assets.

Complexity:

- O(theme files + embedded assets).

Security:

- Avoid false positives on legitimate tracking/ads by using policy and allowlists.

Scalability:

- Cache known theme profiles.

Testing:

- Child theme fixtures.
- Footer injection malware tests.
- Legitimate ad/analytics tests.

### M21. WordPress Core Verification

Responsibilities:

- Verify core files against trusted releases.
- Detect modified, missing, extra, downgraded, or mixed-version core files.

Interfaces:

- verify_core(site_files, wp_version_hint) -> CoreIntegrityReport.

Algorithms:

- Version detection from wp-includes/version.php and manifests.
- Hash comparison to official package manifests.
- Mixed-version detection.
- Locale package handling.

Data structures:

- CoreManifest(version, locale, file_hashes).
- CoreDrift(path, expected_hash, actual_hash, type).

Dependencies:

- Trusted WordPress release manifests.
- Secure manifest update channel.

Failure modes:

- Custom patched core.
- Incomplete upgrades.
- Missing manifests for old versions.

Complexity:

- O(core files).

Security:

- Signed manifest mirror.
- Do not fetch arbitrary manifest URLs from compromised site.

Scalability:

- Global cache of manifests.

Testing:

- WordPress version matrix.
- Locale package tests.
- Incomplete upgrade fixtures.

### M22. Database Forensic Engine

Responsibilities:

- Analyze WordPress database for malicious content, persistence, rogue users, spam, injected scripts, altered roles, and suspicious options.

Interfaces:

- scan_database(snapshot_or_stream, profile) -> DbFindings.
- diff_database_snapshots(old, new) -> DbDiff.

Algorithms:

- Table schema fingerprinting.
- Serialized PHP safe parsing.
- JSON parsing.
- Base64/HTML/URL decoding of option values.
- HTML/JS scanning of posts/options/widgets.
- Rogue admin detection.
- wp_options autoload anomaly detection.
- wp_usermeta capability analysis.
- wp_cron payload extraction.
- Search for hidden iframes, script tags, redirects, and SEO spam.

Data structures:

- DbArtifact(table, primary_key, column, value_hash, sample_ref).
- OptionObservation(name, autoload, size, decoded_layers, risk).
- UserPrivilegeGraph(user -> roles -> capabilities).

Dependencies:

- Database adapter.
- Deobfuscation engine.
- HTML/JS detectors.
- WordPress schema model.

Failure modes:

- Huge tables.
- Corrupt serialized values.
- Custom table prefixes.
- Binary blobs.
- PII exposure.

Complexity:

- O(rows scanned * columns selected * decode cost), bounded by profile.

Security:

- PII redaction.
- Avoid logging raw sensitive rows.
- Transactional remediation.

Scalability:

- Stream rows.
- Prioritize high-risk tables and changed rows.
- Sample very large content tables unless deep mode.

Testing:

- Serialized PHP parser fuzzing.
- wp_cron malware fixtures.
- WooCommerce data privacy tests.
- Database diff tests.

### M23. JavaScript Malware Detection

Responsibilities:

- Detect malicious JavaScript in files, database content, rendered pages, widgets, and inline HTML.

Interfaces:

- analyze_js(source, context) -> JSFindings.

Algorithms:

- Parse to AST.
- Constant folding.
- String array and char-code deobfuscation.
- Control-flow simplification.
- Dangerous API detection: eval, Function constructor, document.write, location redirects, cookie theft, skimmers, dynamic script injection.
- External endpoint extraction.
- DOM sink taint analysis for selected patterns.

Data structures:

- JSAST.
- JSFeatureVector.
- JSBehaviorObservation(api, args, span).

Dependencies:

- JavaScript parser.
- Deobfuscation engine.
- IOC engine.

Failure modes:

- Minified legitimate bundles.
- Framework-generated code.
- Browser-specific runtime behavior.

Complexity:

- O(tokens + AST nodes + decode candidates).

Security:

- Never execute JS outside sandboxed browser profile.
- Respect resource limits.

Scalability:

- Use source maps only if available and safe.
- Cache third-party library hashes.

Testing:

- Magecart/skimmer corpus.
- Benign minified library corpus.
- Obfuscator regression corpus.

### M24. HTML Malware Detection

Responsibilities:

- Detect malicious iframes, scripts, redirects, phishing forms, spam injections, and cloaked content in HTML.

Interfaces:

- analyze_html(document, source_context) -> HtmlFindings.

Algorithms:

- Tolerant HTML parsing.
- DOM extraction.
- Inline JS extraction.
- External resource analysis.
- Hidden element detection.
- Meta refresh and canonical manipulation detection.
- Cloaking comparison across user agents and referrers.

Data structures:

- DOMNode(tag, attributes, text_hash, span).
- ExternalResource(url, type, context).
- HiddenContentObservation(method, node, risk).

Dependencies:

- HTML parser.
- JS analyzer.
- IOC engine.
- HTTP probe engine.

Failure modes:

- Legitimate marketing pixels.
- Page builder artifacts.
- Large generated pages.

Complexity:

- O(document length + DOM nodes).

Security:

- Do not load external resources during static analysis.
- Dynamic crawl uses sandboxed browser.

Scalability:

- Prioritize public home, checkout, login, and high-traffic pages.

Testing:

- SEO spam fixtures.
- Hidden iframe fixtures.
- Legitimate analytics fixtures.

### M25. Web Shell Detection

Responsibilities:

- Detect interactive backdoors and command/file managers.
- Recover trigger parameters and capabilities.

Interfaces:

- detect_web_shell(php_model, features) -> WebShellFinding.

Algorithms:

- Dangerous sink clustering.
- Request parameter to execution sink taint.
- Authentication bypass pattern detection.
- UI artifact detection for file manager shells.
- Capability extraction: command exec, upload, download, DB access, credential theft, persistence.
- Symbolic execution for trigger conditions.

Data structures:

- WebShellCapability(type, evidence_span, confidence).
- TriggerCondition(parameter, value_constraint, method).

Dependencies:

- AST, CFG, DFG, taint, symbolic execution.
- Signature and heuristic engines.

Failure modes:

- Admin tools resembling shells.
- Obfuscated shells.
- Dead code shells.

Complexity:

- Dominated by taint and symbolic execution, bounded by suspicious slice size.

Security:

- Do not execute shell code.
- Preserve shell as evidence before quarantine.

Scalability:

- Fast prefilter by dangerous API and request access.
- Deep analysis only on candidates.

Testing:

- Known shell corpus.
- Legitimate admin plugin corpus.
- Trigger extraction golden tests.

### M26. Hidden Persistence Detection

Responsibilities:

- Find persistence beyond obvious infected files.
- Detect backdoored hooks, cron entries, rogue admins, database payloads, mu-plugins, drop-ins, .user.ini, .htaccess, wp-config modifications, cache poisoning, and autoloaded options.

Interfaces:

- detect_persistence(site_model) -> PersistenceFindings.

Algorithms:

- Persistence surface inventory.
- Hook graph anomaly detection.
- Autoload option risk scoring.
- Scheduled task inspection.
- Privilege graph analysis.
- Startup/include path analysis.
- Diff against clean baseline.

Data structures:

- PersistencePoint(type, location, activation_condition, evidence).
- StartupGraph(entrypoint -> included files/hooks/options).

Dependencies:

- Database forensics.
- Plugin/theme/core intelligence.
- File scanner.
- AST hook analysis.

Failure modes:

- Legitimate mu-plugins.
- Managed host drop-ins.
- Complex page builder storage.

Complexity:

- O(persistence surfaces + relevant AST facts).

Security:

- High-risk remediation requires approval.
- Preserve activation graph.

Scalability:

- Site baseline reduces repeated work.

Testing:

- Persistence scenario fixtures.
- Managed host compatibility tests.
- False-positive tests for legitimate cron/mu-plugins.

### M27. Cron Detection

Responsibilities:

- Analyze WordPress cron, server cron where accessible, and pseudo-cron abuse.
- Detect malicious scheduled payloads and persistence.

Interfaces:

- analyze_cron(wp_cron_option, server_cron_artifacts) -> CronFindings.

Algorithms:

- Safe unserialization of cron option.
- Callback resolution.
- Schedule anomaly detection.
- Payload extraction from arguments.
- Recently added task correlation.

Data structures:

- CronEntry(hook, schedule, next_run, args_hash, callback_resolution).
- CronAnomaly(reason, evidence).

Dependencies:

- Database forensics.
- AST hook model.
- Timeline engine.

Failure modes:

- Corrupt cron option.
- Dynamic callbacks.
- Unknown custom schedules.

Complexity:

- O(cron entries + callback resolution).

Security:

- Do not invoke callbacks.
- Remediation must preserve legitimate scheduled tasks.

Scalability:

- Cron tables are usually small.

Testing:

- Malicious cron fixtures.
- Legitimate plugin cron fixtures.
- Corrupt serialization tests.

### M28. Filesystem Integrity

Responsibilities:

- Track file changes, ownership, permissions, symlinks, and baseline drift.
- Detect unauthorized modifications and suspicious writable executable paths.

Interfaces:

- build_fs_baseline(site) -> Baseline.
- diff_fs(current, baseline) -> IntegrityFindings.

Algorithms:

- Merkle tree baseline.
- Component-aware hash comparison.
- Permission anomaly detection.
- Recently modified executable ranking.
- Symlink target validation.

Data structures:

- FsBaseline(version, merkle_root, entries).
- FsDelta(path, change_type, old_meta, new_meta).

Dependencies:

- File manifest.
- Component manifests.
- Evidence storage.

Failure modes:

- No previous baseline.
- Host permission inconsistencies.
- Clock skew.

Complexity:

- O(file count + changed bytes hashed).

Security:

- Baseline stored outside WordPress where possible.
- Tamper-evident baseline history.

Scalability:

- Incremental hash updates.
- Directory-level Merkle pruning.

Testing:

- Baseline drift tests.
- Symlink traversal tests.
- Clock skew tests.

### M29. Sandbox Architecture

Responsibilities:

- Execute suspicious artifacts or reconstructed site fragments safely for behavioral observation.
- Support PHP, JavaScript/browser, HTTP, and network simulations.

Interfaces:

- run_sandbox(artifact_set, profile, budget) -> BehaviorReport.

Algorithms:

- Container or microVM isolation.
- Snapshot and discard filesystem.
- Network egress sinkhole.
- Syscall and process monitoring.
- PHP function instrumentation.
- Browser automation for rendered page behavior.
- Differential environment profiles to defeat simple evasion.

Data structures:

- SandboxProfile(language, network_policy, env_vars, time_profile, user_agent).
- BehaviorEvent(type, timestamp, process, api, args_redacted).

Dependencies:

- Firecracker/gVisor/Kata/containers depending deployment.
- Instrumented PHP runtime.
- Headless browser.
- Network sinkhole.

Failure modes:

- Sandbox escape attempt.
- Evasion due to environment checks.
- Resource exhaustion.
- Non-deterministic behavior.

Complexity:

- Bounded by wall time and event volume.

Security:

- No access to production credentials.
- No real outbound Internet except controlled proxy.
- Reset sandbox after each run.
- Strict kernel and container hardening.

Scalability:

- Queue sandbox jobs separately.
- Use cheaper static analysis prefilters.
- Pool warm images.

Testing:

- Escape hardening tests.
- Evasion fixtures.
- Network sinkhole tests.
- Browser behavior tests.

### M30. Behavioral Analysis

Responsibilities:

- Convert sandbox events into behavior findings.
- Detect file writes, command execution, credential access, network beacons, code injection, and persistence actions.

Interfaces:

- analyze_behavior(events) -> BehaviorFindings.

Algorithms:

- Event sequence matching.
- Behavior graph construction.
- MITRE ATT&CK-like technique mapping adapted to WordPress.
- Beacon and redirect pattern detection.

Data structures:

- BehaviorGraph(nodes=process/file/network/api, edges=events).
- TechniqueMapping(technique_id, evidence).

Dependencies:

- Sandbox event stream.
- IOC engine.
- Rule engine.

Failure modes:

- Sparse execution paths.
- Evasive samples.
- Benign installer behavior.

Complexity:

- O(events + rules).

Security:

- Redact secrets in event args.
- Do not replay real credentials.

Scalability:

- Event sampling for noisy processes.
- Persist only relevant traces after summarization.

Testing:

- Behavior sequence fixtures.
- Benign installer fixtures.
- Evasion tests.

### M31. Timeline Reconstruction

Responsibilities:

- Build incident timelines from filesystem, database, logs, scans, agents, backups, vulnerabilities, and user activity.

Interfaces:

- build_timeline(case_or_site, time_range) -> Timeline.

Algorithms:

- Event normalization.
- Clock skew correction.
- Confidence scoring for timestamps.
- Causal ordering heuristics.
- Timeline clustering by incident.

Data structures:

- TimelineEvent(time, source, type, actor, object, confidence, evidence_id).
- TemporalRelation(before, after, confidence, reason).

Dependencies:

- Evidence store.
- Log parsers.
- Scan results.
- Database diffs.

Failure modes:

- Missing logs.
- Tampered timestamps.
- Timezone ambiguity.
- Clock skew.

Complexity:

- O(events log events) for sorting, plus correlation cost.

Security:

- Preserve original timestamps and normalized timestamps.
- Flag suspected timestomping.

Scalability:

- Index by site and time.
- Incremental timeline updates.

Testing:

- Multi-source timestamp fixtures.
- Timestomping tests.
- Timezone tests.

### M32. Root Cause Analysis

Responsibilities:

- Infer likely initial access and contributing factors.
- Connect vulnerability, exploit evidence, changed artifacts, accounts, and persistence.

Interfaces:

- infer_root_cause(incident_graph) -> RootCauseHypotheses.

Algorithms:

- Rule-based hypothesis generation.
- Bayesian-style evidence weighting.
- Vulnerability exploitability correlation.
- First-seen analysis.
- Log pattern matching for exploit attempts.

Data structures:

- RootCauseHypothesis(type, confidence, evidence, missing_evidence, recommended_validation).

Dependencies:

- Timeline.
- Vulnerability intelligence.
- Log analysis.
- Incident graph.

Failure modes:

- Missing logs.
- Multiple simultaneous compromises.
- Post-compromise cleanup by attacker.

Complexity:

- O(incident graph edges + timeline events + applicable vulns).

Security:

- Present hypotheses, not unsupported certainty.
- Record assumptions and missing evidence.

Scalability:

- Analyze per incident cluster.

Testing:

- Historical incident fixtures.
- Missing evidence tests.
- Competing root cause tests.

### M33. Incident Correlation

Responsibilities:

- Group findings into incidents and campaigns.
- Correlate across sites and tenants when policy permits.

Interfaces:

- correlate_findings(findings, context) -> Incidents.

Algorithms:

- Graph clustering.
- Shared IOC/hash/signature/fuzzy hash linkage.
- Temporal proximity.
- Component vulnerability linkage.
- Cross-site campaign similarity.

Data structures:

- IncidentGraph(nodes, edges, weights).
- CorrelationEdge(source, target, reason, weight).

Dependencies:

- Findings.
- IOC/intel platform.
- Graph store.

Failure modes:

- Over-grouping unrelated malware.
- Under-grouping staged campaigns.
- Privacy limits on cross-tenant correlation.

Complexity:

- Local correlation O(nodes + edges).
- Global similarity requires indexed lookup and ANN/fuzzy hash matching.

Security:

- Cross-tenant sharing uses anonymized features unless consented.
- Tenant isolation in graph queries.

Scalability:

- Incremental graph updates.
- Partition by tenant and campaign.

Testing:

- Campaign clustering corpus.
- Cross-tenant privacy tests.
- Over/under-clustering metrics.

### M34. Multi-Site Intelligence

Responsibilities:

- Provide portfolio-level risk and campaign visibility.
- Detect shared compromise patterns across managed sites.

Interfaces:

- portfolio_risk(tenant) -> PortfolioRiskReport.
- cross_site_campaigns(tenant) -> Campaigns.

Algorithms:

- Shared component risk aggregation.
- Common IOC/hash clustering.
- Blast radius analysis by shared credentials, hosting, plugins, and IPs.
- Fleet drift detection.

Data structures:

- FleetComponentIndex(component -> sites).
- SharedRiskCluster(sites, reason, severity).

Dependencies:

- Site inventories.
- Incident correlation.
- Vulnerability intelligence.

Failure modes:

- Incomplete inventory.
- Shared hosting ambiguity.
- Private component naming conflicts.

Complexity:

- O(sites * components) for inventory index updates.

Security:

- Tenant-scoped by default.
- Managed service provider access must be delegated.

Scalability:

- Materialized fleet indexes.
- Incremental updates.

Testing:

- MSP tenant hierarchy tests.
- Shared plugin outbreak simulation.

### M35. Risk Scoring

Responsibilities:

- Score findings, incidents, sites, components, and portfolios.
- Provide explainable prioritization.

Interfaces:

- score_finding(finding, context) -> RiskScore.
- score_site(site_state) -> SiteRisk.

Algorithms:

- Weighted scoring with calibrated detector confidence.
- Severity, confidence, exploitability, asset criticality, exposure, persistence, privilege, active exploitation, and remediation difficulty.
- Bayesian-inspired evidence combination avoiding naive double counting.
- Score decay after remediation and verification.

Data structures:

- RiskFactor(name, value, weight, evidence).
- RiskScore(value, band, confidence, explanation).

Dependencies:

- Detector outputs.
- Asset criticality config.
- Vulnerability intel.
- Policy engine.

Failure modes:

- Double-counting correlated detections.
- Misconfigured asset criticality.
- Score inflation from noisy rules.

Complexity:

- O(factors per entity).

Security:

- Scores must not hide raw evidence.
- Automation thresholds require policy approval.

Scalability:

- Recompute incrementally on finding changes.

Testing:

- Golden scoring fixtures.
- Calibration against analyst labels.
- Regression tests for threshold changes.

### M36. Automatic Remediation Planning

Responsibilities:

- Generate safe, ordered, reversible remediation plans.
- Explain impact, preconditions, rollback, and verification.

Interfaces:

- build_remediation_plan(incident, policy) -> Plan.
- execute_plan(plan_id, approval) -> ExecutionResult.

Algorithms:

- Action dependency graph.
- Preconditions and invariants.
- Backup/evidence requirements.
- Risk-based approval gates.
- Dry-run diff generation.
- Post-action verification scanning.

Data structures:

- RemediationAction(type, target, preconditions, rollback, risk).
- RemediationPlan(actions, dependencies, approvals, verification_steps).

Dependencies:

- Evidence collector.
- Agent.
- Policy engine.
- Backup integration.

Failure modes:

- File changes race with site updates.
- Database transaction failure.
- Plugin update incompatibility.
- False positive cleanup.

Complexity:

- Plan generation O(findings + dependencies).
- Execution depends on action count and artifact sizes.

Security:

- Never remediate without preserving evidence.
- Require approval for destructive or uncertain actions.
- Verify signatures before restoring clean components.

Scalability:

- Batch similar actions.
- Fleet remediation with canary rollout.

Testing:

- Dry-run diff tests.
- Rollback tests.
- Concurrent update tests.
- False-positive safety tests.

### M37. Reporting

Responsibilities:

- Produce executive, technical, forensic, compliance, and remediation reports.

Interfaces:

- generate_report(case_id, template, audience) -> PDF/HTML/JSON.

Algorithms:

- Evidence summarization.
- Finding grouping.
- Timeline rendering.
- Risk explanation generation.
- Redaction by audience.

Data structures:

- ReportTemplate.
- ReportSection.
- EvidenceReference.

Dependencies:

- Case data.
- Evidence store.
- Rendering service.

Failure modes:

- Excessively large reports.
- Sensitive data leakage.
- Broken rendering.

Complexity:

- O(report entities + rendered assets).

Security:

- Role-aware redaction.
- Watermarking and audit on exports.

Scalability:

- Asynchronous generation.
- Cache immutable report versions.

Testing:

- Snapshot rendering tests.
- Redaction tests.
- Large case tests.

### M38. REST API

Responsibilities:

- Provide programmatic access to tenants, sites, scans, findings, incidents, evidence, policies, and remediation.

Interfaces:

- Public REST API with OpenAPI specification.
- Webhooks for scan complete, finding created, remediation done, and case updated.

Algorithms:

- Cursor pagination.
- Idempotency keys for mutating operations.
- Rate limiting.
- Request signing for agents/webhooks.

Data structures:

- APIResource envelopes.
- Error model with stable codes.
- Audit context.

Dependencies:

- Auth service.
- Core services.
- API gateway.

Failure modes:

- Version compatibility.
- Abuse or scraping.
- Partial failures.

Complexity:

- Endpoint-specific.

Security:

- OAuth2/OIDC for users.
- mTLS or signed tokens for agents.
- Object-level authorization.
- Rate limits.

Scalability:

- Stateless API replicas.
- Read replicas and caching.

Testing:

- Contract tests.
- Authorization matrix tests.
- Idempotency tests.
- Rate-limit tests.

### M39. CLI

Responsibilities:

- Support local scans, CI checks, evidence bundle creation, offline analysis, and automation.

Interfaces:

- Commands: auth, site register, scan, collect, analyze, findings, evidence export, remediation dry-run, policy validate.

Algorithms:

- Local config resolution.
- Streaming progress.
- Exit codes for CI.
- Offline bundle signing.

Data structures:

- CLIConfig.
- EvidenceBundleManifest.

Dependencies:

- Core scanner libraries.
- API client.

Failure modes:

- Credential expiry.
- Local permission issues.
- Interrupted offline bundle.

Complexity:

- Depends on command.

Security:

- Secure credential storage.
- No secrets in command output by default.

Scalability:

- Suitable for CI and local use, not primary fleet scheduler.

Testing:

- Golden command output tests.
- Exit code tests.
- Offline bundle tests.

### M40. Desktop Application

Responsibilities:

- Provide offline triage, evidence review, case notes, and local bundle analysis for responders.

Interfaces:

- Open encrypted evidence bundles.
- Sync case notes when online.
- Render timelines, graphs, and reports.

Algorithms:

- Local encrypted cache.
- Conflict-free note sync or explicit merge.
- Local search indexing.

Data structures:

- LocalCaseCache.
- OfflineNote.
- BundleIndex.

Dependencies:

- Cross-platform desktop framework.
- Local scanner libraries.
- Local database such as SQLite.

Failure modes:

- Bundle corruption.
- Sync conflicts.
- Local key loss.

Complexity:

- Search and graph operations depend on case size.

Security:

- Local encryption.
- OS keychain integration.
- Optional air-gapped mode.

Scalability:

- Designed for case-scale, not fleet-scale.

Testing:

- Offline workflows.
- Corrupt bundle tests.
- Local encryption tests.

### M41. Web Dashboard

Responsibilities:

- Provide enterprise UI for sites, scans, findings, incidents, reports, remediation, policies, intelligence, and administration.

Interfaces:

- Browser UI backed by REST/GraphQL internal aggregation APIs.

Algorithms:

- Server-side filtering and pagination.
- Real-time updates via WebSocket or SSE.
- Risk and timeline visualization.

Data structures:

- View models for findings, incidents, timelines, fleet risk, and remediation plans.

Dependencies:

- API.
- Auth.
- Search index.

Failure modes:

- Large query latency.
- Stale cached data.
- Authorization UI mismatch.

Complexity:

- UI data retrieval must be paginated and indexed.

Security:

- CSP.
- XSS prevention.
- CSRF protections where cookies used.
- Object authorization enforced server-side.

Scalability:

- CDN static assets.
- API pagination.
- Async exports.

Testing:

- E2E tests.
- Accessibility tests.
- Authorization tests.
- Visual regression tests.

### M42. Authentication

Responsibilities:

- Authenticate users, agents, services, and integrations.

Interfaces:

- OIDC/SAML SSO.
- Local auth for small deployments.
- API tokens.
- Agent certificates/tokens.
- SCIM provisioning.

Algorithms:

- MFA enforcement.
- Session rotation.
- Token binding where practical.
- Device/session risk checks.

Data structures:

- Principal.
- Session.
- Credential.
- AgentIdentity.

Dependencies:

- IdP integrations.
- KMS.
- Audit service.

Failure modes:

- IdP outage.
- Token leakage.
- Clock skew.

Complexity:

- Auth checks O(roles/policies) with caching.

Security:

- MFA.
- Short-lived tokens.
- Refresh token rotation.
- Phishing-resistant auth option.

Scalability:

- Cache JWKS and permission decisions.

Testing:

- SSO flows.
- Token revocation.
- Agent auth tests.

### M43. RBAC and Authorization

Responsibilities:

- Enforce least privilege across UI, API, evidence, remediation, intelligence, and admin operations.

Interfaces:

- authorize(subject, action, resource, context) -> allow/deny.

Algorithms:

- RBAC roles plus ABAC conditions for tenant, site, case, environment, and sensitivity.
- Permission decision caching with invalidation.

Data structures:

- Role.
- Permission.
- PolicyBinding.
- ResourceScope.

Dependencies:

- Auth service.
- Policy engine.

Failure modes:

- Overbroad roles.
- Cache stale after revocation.
- Confused deputy.

Complexity:

- O(bindings relevant to subject/resource).

Security:

- Deny by default.
- Object-level checks.
- Separation of duties for remediation and rule publishing.

Scalability:

- Precompute effective roles for common scopes.

Testing:

- Authorization matrix.
- Negative tests.
- Revocation tests.

### M44. Cryptography

Responsibilities:

- Protect data in transit, at rest, evidence integrity, update signing, license tokens, and tenant secrets.

Interfaces:

- KMS abstraction.
- Signing service.
- Encryption service.

Algorithms:

- TLS 1.3.
- Envelope encryption with per-tenant data keys.
- Ed25519 or ECDSA signatures for updates/rules.
- SHA-256/BLAKE3 hashing.
- HMAC for webhook signing.
- Password hashing with Argon2id where local passwords exist.

Data structures:

- KeyReference.
- SignatureEnvelope.
- EncryptedBlobMetadata.

Dependencies:

- Cloud KMS/HSM or self-hosted equivalent.
- Key rotation service.

Failure modes:

- Key loss.
- Rotation failure.
- Weak random source.
- Signature verification bypass.

Complexity:

- O(data size) for encryption/hash.

Security:

- No custom cryptographic primitives.
- Strict key separation.
- Regular key rotation.
- Hardware-backed roots for hosted service.

Scalability:

- Data-key caching with short TTL.
- Batch signing where safe.

Testing:

- Known-answer crypto tests.
- Rotation tests.
- Tamper tests.

### M45. Secure Update System

Responsibilities:

- Distribute agent, scanner, rule, model, and intelligence updates securely.

Interfaces:

- Update metadata API.
- Artifact download API.
- Rollback API.

Algorithms:

- The Update Framework style metadata with threshold signatures.
- Staged rollout.
- Canary validation.
- Version pinning.
- Rollback on health regression.

Data structures:

- UpdateManifest(version, artifact_hashes, signatures, compatibility).
- RolloutPolicy(channel, percentage, constraints).

Dependencies:

- Signing service.
- CDN/object storage.
- Telemetry health metrics.

Failure modes:

- Bad rule release.
- CDN compromise.
- Downgrade attack.
- Incompatible agent.

Complexity:

- O(artifacts) verification plus download size.

Security:

- Mandatory signature verification.
- Anti-rollback metadata.
- Separate signing roles.

Scalability:

- CDN distribution.
- Delta updates for large rule/model packs.

Testing:

- Downgrade attack tests.
- Bad release rollback drills.
- Signature failure tests.

### M46. Logging

Responsibilities:

- Capture operational, security, audit, scan, and analyzer logs without leaking secrets.

Interfaces:

- Structured logging API.
- Log export to SIEM.

Algorithms:

- Structured event schema.
- Redaction filters.
- Sampling for high-volume debug logs.

Data structures:

- LogEvent(timestamp, severity, service, tenant_id, trace_id, fields).

Dependencies:

- Log collector.
- SIEM export.
- OpenTelemetry.

Failure modes:

- Log storms.
- Sensitive data leakage.
- Lost logs.

Complexity:

- O(events).

Security:

- Redaction by default.
- Restricted access.
- Integrity controls for audit logs.

Scalability:

- Async batching.
- Backpressure and sampling.

Testing:

- Redaction tests.
- Schema tests.
- Load tests.

### M47. Audit Trails

Responsibilities:

- Record security-relevant actions immutably.

Interfaces:

- append_audit_event(event).
- query_audit(scope).
- export_audit(scope).

Algorithms:

- Append-only event log.
- Hash chaining.
- Optional external timestamping.

Data structures:

- AuditEvent(id, actor, action, resource, timestamp, ip, user_agent, previous_hash, event_hash).

Dependencies:

- PostgreSQL append-only table or log store.
- Object storage for exports.

Failure modes:

- Clock skew.
- Storage outage.
- High volume.

Complexity:

- Append O(1).
- Query depends on indexes.

Security:

- Immutable retention.
- Admin actions audited.
- No silent deletion.

Scalability:

- Partition by tenant and month.

Testing:

- Hash chain verification.
- Retention tests.
- Admin action coverage tests.

### M48. Database Schema

Responsibilities:

- Persist tenants, sites, scans, artifacts, observations, findings, incidents, cases, intelligence, policies, users, audit events, and jobs.

Interfaces:

- Service-owned repository layer.
- Migration system.
- Read models for dashboard/search.

Core tables:

- tenants(id, name, plan, region, created_at).
- organizations(id, tenant_id, name).
- sites(id, tenant_id, org_id, url, wp_version, environment, criticality, created_at).
- agents(id, tenant_id, site_id, public_key, version, status, last_seen_at).
- scans(id, tenant_id, site_id, profile, status, started_at, completed_at, rule_versions, engine_versions).
- artifacts(id, tenant_id, scan_id, type, hash, size, storage_uri, metadata_json, created_at).
- evidence_items(id, tenant_id, artifact_id, hash, key_id, custody_state, acquired_at).
- observations(id, tenant_id, scan_id, artifact_id, module, type, data_json, confidence).
- findings(id, tenant_id, site_id, scan_id, severity, confidence, status, title, detector_id, evidence_json).
- incidents(id, tenant_id, site_id, status, severity, risk_score, first_seen, last_seen).
- incident_edges(id, tenant_id, incident_id, source_type, source_id, relation, target_type, target_id, weight).
- cases(id, tenant_id, title, status, owner_id, created_at, closed_at).
- vulnerabilities(id, source, external_id, aliases_json, affected_json, severity, fixed_json).
- components(id, tenant_id, site_id, type, slug, version, hash, active).
- iocs(id, tenant_id nullable, type, value_hash, normalized_value_encrypted, confidence).
- rules(id, pack_id, type, version, signature, metadata_json).
- policies(id, tenant_id, scope, version, document_json, status).
- remediation_plans(id, tenant_id, incident_id, status, plan_json, risk).
- audit_events(id, tenant_id, actor_id, action, resource, event_hash, previous_hash, created_at).

Indexes:

- tenant_id on every tenant-scoped table.
- findings(site_id, status, severity).
- artifacts(hash).
- scans(site_id, started_at).
- observations(artifact_id, module, type).
- components(slug, version).
- vulnerabilities(external_id).
- audit_events(tenant_id, created_at).
- incidents(tenant_id, status, risk_score).

Failure modes:

- Migration failure.
- Hot tenants.
- Large JSON fields.
- Cross-tenant query bug.

Security:

- Row-level tenancy where practical.
- Encryption for sensitive columns.
- Strict migrations review.

Scalability:

- Partition large tables by tenant/time.
- Move bulky evidence to object storage.
- Use read models/search indexes for UI.

Testing:

- Migration rollback tests.
- Tenant isolation tests.
- Query performance tests.

### M49. Caching

Responsibilities:

- Reduce repeated analysis, metadata lookup, and UI latency.

Interfaces:

- Artifact analysis cache.
- Component metadata cache.
- Authorization decision cache.
- API response cache for safe reads.

Algorithms:

- Content-addressed cache keys.
- Versioned cache invalidation.
- TTL for external intel.
- Negative caching for missing metadata.

Data structures:

- CacheKey(input_hash, module_version, rule_version, options_hash).
- CacheEntry(value_ref, expires_at, dependencies).

Dependencies:

- Redis or equivalent.
- Persistent cache for analysis artifacts.

Failure modes:

- Stale rules.
- Cache poisoning.
- Memory pressure.

Complexity:

- O(1) common key lookup.

Security:

- Tenant-aware keys.
- Do not cache sensitive raw evidence in shared memory unless encrypted.

Scalability:

- Distributed cache.
- Local worker cache for hot rule packs.

Testing:

- Invalidation tests.
- Poisoning tests.
- Tenant key separation tests.

### M50. Search Indexing

Responsibilities:

- Enable fast search across findings, evidence metadata, IOCs, components, timelines, and cases.

Interfaces:

- Index event pipeline.
- Search API.

Algorithms:

- Denormalized indexing.
- Field-level access filtering.
- Incremental updates from events.

Data structures:

- FindingDocument.
- EvidenceMetadataDocument.
- TimelineDocument.
- IOCDocument.

Dependencies:

- OpenSearch/Elasticsearch-compatible index.
- Event bus.

Failure modes:

- Index lag.
- Authorization mismatch.
- Reindex failures.

Complexity:

- Search depends on query/index.
- Indexing O(documents).

Security:

- Never rely solely on search index for authorization.
- Redact sensitive fields before indexing.

Scalability:

- Shard by tenant tier/time.
- Bulk indexing.

Testing:

- Index consistency tests.
- Access-control tests.
- Reindex drills.

### M51. Performance Optimization

Responsibilities:

- Ensure scans are practical on production WordPress environments and large fleets.

Strategies:

- Incremental scanning.
- Analyzer routing by file type and suspicion.
- Multi-level cache.
- Work queues.
- Resource budgets.
- Hot path in compiled language.
- Batch database reads.
- Avoid production load by offloading to workers.
- Use sampling in low-risk areas and deep mode for incidents.

Failure modes:

- I/O saturation.
- Database lock contention.
- Worker memory spikes.
- Rule pack bloat.

Testing:

- Large site benchmarks.
- Shared-hosting benchmarks.
- Million-file synthetic corpus.
- Multi-tenant load tests.

### M52. Parallel Processing

Responsibilities:

- Exploit concurrency safely across files, analyzers, sites, and tenants.

Algorithms:

- Worker pool per task class.
- Bounded parallel file analysis.
- DAG scheduling.
- Backpressure from CPU/memory/I/O.
- Adaptive concurrency.

Data structures:

- WorkQueue.
- Lease.
- WorkerHeartbeat.

Security:

- Isolate tenant contexts.
- Avoid shared mutable analyzer state across tenants.

Testing:

- Race tests.
- Duplicate task idempotency tests.
- Load and chaos tests.

### M53. Plugin System

Responsibilities:

- Allow internal and third-party extensions for analyzers, decoders, rules, reports, integrations, and remediation actions.

Interfaces:

- Analyzer plugin API.
- Decoder plugin API.
- Rule pack API.
- Integration webhook API.
- Report template API.

Algorithms:

- Capability-based plugin permissions.
- Sandboxed execution via WASM or isolated process.
- Signed plugin packages.
- Compatibility negotiation.

Data structures:

- PluginManifest(id, version, capabilities, permissions, signatures).
- PluginResult(observations, findings, metrics).

Dependencies:

- Plugin registry.
- Signing service.
- Sandbox runtime.

Failure modes:

- Malicious plugin.
- Plugin crash.
- API version mismatch.

Complexity:

- Plugin-dependent, bounded by host budgets.

Security:

- Deny filesystem/network by default.
- Signed packages.
- Per-tenant allowlists.
- Output validation.

Scalability:

- Plugin workers scale independently.

Testing:

- SDK contract tests.
- Sandbox escape tests.
- Compatibility tests.

### M54. Rule Engine

Responsibilities:

- Evaluate detection, policy, suppression, scoring, remediation, and routing rules.

Interfaces:

- evaluate(rule_set, facts, context) -> decisions.
- validate_rules(rule_pack) -> lint report.

Algorithms:

- Declarative rule evaluation.
- Fact indexing.
- Conflict detection.
- Rule coverage tracking.

Data structures:

- Fact.
- Rule(condition, action, metadata).
- Decision(result, explanation, rule_id).

Dependencies:

- Rule compiler.
- Signed pack store.

Failure modes:

- Conflicting rules.
- Expensive predicates.
- Overbroad suppressions.

Complexity:

- O(relevant facts + matching rules), optimized by indexes.

Security:

- No arbitrary code.
- Bounded evaluation.
- Signed rules.

Scalability:

- Precompile rules.
- Partition by domain.

Testing:

- Rule unit tests.
- Conflict tests.
- Performance tests.

### M55. Configuration System

Responsibilities:

- Manage tenant, site, scan profile, policy, retention, telemetry, and integration configuration.

Interfaces:

- Config API.
- Policy validation.
- Effective config resolver.

Algorithms:

- Hierarchical configuration: global -> tenant -> org -> site -> environment -> scan.
- Schema validation.
- Drift detection.
- Change audit.

Data structures:

- ConfigDocument(scope, version, data, status).
- EffectiveConfig.

Dependencies:

- PostgreSQL.
- Policy engine.

Failure modes:

- Conflicting overrides.
- Invalid config rollout.
- Stale agent config.

Complexity:

- O(scope depth + document size).

Security:

- Sensitive config encrypted.
- Changes audited.
- Approval for high-risk automation.

Scalability:

- Cache effective config.
- Push invalidation to agents.

Testing:

- Precedence tests.
- Validation tests.
- Rollback tests.

### M56. Licensing Architecture

Responsibilities:

- Enforce commercial entitlements without compromising security or offline operation.

Interfaces:

- License activation.
- Entitlement check.
- Offline license file.
- Usage reporting.

Algorithms:

- Signed license tokens.
- Grace periods.
- Feature flags from entitlements.
- Offline verification.

Data structures:

- License(tenant, features, site_limit, expiry, signature).
- UsageMetric.

Dependencies:

- Billing/licensing service.
- Signing keys.

Failure modes:

- License server outage.
- Clock tampering.
- Over-limit tenants.

Complexity:

- O(1) entitlement checks after cache.

Security:

- License failure must not disable emergency detection/remediation already entitled within grace.
- No security-critical logic hidden solely behind remote checks.

Scalability:

- Local cache and batch usage sync.

Testing:

- Offline mode tests.
- Expiry/grace tests.
- Tamper tests.

## 15. Enterprise Architecture

### 15.1 Control Plane

- Manages tenants, users, sites, agents, scan schedules, policies, rules, licenses, and updates.
- Must be highly available.
- Does not need raw evidence for every deployment if customers run private evidence stores.

### 15.2 Data Plane

- Collects evidence, processes artifacts, runs analyzers, stores results, and executes remediation.
- Can run in vendor cloud, customer cloud, Kubernetes, Docker, or offline appliance.

### 15.3 Trust Boundaries

- Browser to API.
- Agent to control plane.
- Worker to evidence store.
- Tenant to tenant.
- Analyzer sandbox to worker host.
- Update publisher to update consumer.
- Intelligence ingestion to signed production rules.

### 15.4 Deployment Topologies

- SaaS: vendor-hosted control and data plane.
- Hybrid: vendor control plane, customer data plane and evidence store.
- Private cloud: customer-hosted full stack.
- Air-gapped: offline rule/model bundles and manual update import.
- MSP: delegated tenant hierarchy with customer isolation.

## 16. Cloud Deployment

Recommended components:

- API gateway and WAF.
- Kubernetes or managed container runtime.
- PostgreSQL managed database.
- Object storage with immutability.
- Redis.
- OpenSearch.
- Message queue.
- KMS/HSM.
- Observability stack.
- CDN for update artifacts.

Cloud controls:

- Private networking.
- Workload identity.
- Secrets manager.
- Network egress control.
- Separate production, staging, and research accounts/projects.
- Backup and disaster recovery.

Failure modes:

- Regional outage.
- KMS outage.
- Queue backlog.
- Search index degradation.

Design response:

- Multi-AZ for core services.
- Regional isolation for tenant data residency.
- DR runbooks.
- Graceful degradation where analysis queues pause but evidence remains safe.

## 17. Docker Deployment

Use cases:

- Small enterprise private deployment.
- Evaluation environment.
- Developer/testing environment.

Components:

- api.
- web.
- worker.
- scheduler.
- postgres.
- redis.
- opensearch.
- object-storage-compatible service.

Security:

- Not recommended for large production without hardened host, TLS, backups, and external secrets.
- Containers run as non-root.
- Read-only filesystems where possible.
- Explicit resource limits.

Testing:

- Compose smoke tests.
- Upgrade tests.
- Backup restore tests.

## 18. Kubernetes Deployment

Components:

- Deployments for API, web, orchestrator, workers, indexer, intel ingestion, update service.
- Stateful services preferably managed externally for production.
- Horizontal pod autoscalers for workers.
- Network policies.
- Pod security standards.
- Secrets via external secret operator.
- Jobs for migrations and batch reindexing.

Security:

- Separate namespaces by environment.
- Service accounts per service.
- No privileged pods except carefully isolated sandbox nodes if required.
- Sandbox workloads on tainted node pools.

Scalability:

- Scale analysis workers by queue depth.
- Separate worker pools for cheap static analysis and expensive sandboxing.

Testing:

- Helm chart tests.
- Policy tests.
- Disaster recovery drills.

## 19. CI/CD

Pipeline stages:

- Dependency review and SBOM generation.
- Static analysis.
- Unit tests.
- Integration tests.
- Parser fuzz corpus run.
- Malware benchmark regression.
- Container image build.
- Image signing.
- SLSA-style provenance.
- Staging deployment.
- Canary rollout.
- Production deployment.

Release controls:

- Separate code, rule, model, and intelligence release pipelines.
- Human approval for high-impact rule packs.
- Automated rollback triggers.
- Reproducible builds where practical.

Security:

- Least privilege CI tokens.
- Ephemeral runners.
- Secrets scanning.
- Artifact signing.
- Protected branches.

## 20. Testing Strategy

### 20.1 Unit Testing

- Parser units for every supported syntax form.
- Decoder units for each transform.
- Rule engine units.
- Risk scoring units.
- Remediation action units.
- Auth and authorization units.

### 20.2 Integration Testing

- Full scan of clean WordPress.
- Full scan of infected WordPress.
- Agent registration through scan completion.
- Evidence capture through report generation.
- Remediation dry-run and execution in disposable environment.
- STIX/TAXII import/export.
- SIEM webhook export.

### 20.3 Fuzz Testing

- PHP parser.
- JS parser adapter.
- HTML parser adapter.
- Serialized PHP parser.
- Archive extraction.
- Deobfuscation transforms.
- Rule parser.
- API input schemas.

### 20.4 Malware Benchmark Testing

Benchmark sets:

- Known web shells.
- PHP obfuscators.
- SEO spam injections.
- JavaScript skimmers.
- Redirect malware.
- Rogue admin/database persistence.
- Malicious cron entries.
- Backdoored plugins/themes.
- Clean WordPress core and popular clean plugins/themes.
- Commercial plugin benign corpus where licensed.

Metrics:

- Detection rate.
- Family classification accuracy.
- False-positive rate.
- Time to detect.
- Explainability completeness.
- Remediation safety.
- Resource usage.

### 20.5 False-Positive Analysis

Process:

- Every severe finding type must have benign counterexamples.
- Analyst review queue captures FP labels.
- Rule changes require FP regression pass.
- Suppressions require scope, expiration, and justification.
- Risk scoring must distinguish suspicious admin tools from unauthorized shells.

### 20.6 False-Negative Analysis

Process:

- Missed samples become regression fixtures.
- Root cause of miss classified as parser gap, decoder gap, rule gap, model gap, intel gap, or evidence gap.
- Detection improvements must avoid unacceptable FP increase.
- Time-based holdout sets evaluate generalization.

## 21. Monitoring and Telemetry

Telemetry categories:

- Operational metrics: queue depth, scan duration, worker CPU/memory, error rates.
- Detection metrics: rule hit rates, finding volume, FP/FN labels, model drift.
- Security metrics: failed auth, privilege changes, update verification failures, audit anomalies.
- Product metrics: active sites, scan coverage, remediation completion.

Technology:

- OpenTelemetry for traces, metrics, and logs.
- Prometheus-compatible metrics.
- Central log aggregation.
- Alert manager.

Privacy:

- Telemetry must be tenant-configurable.
- Raw artifacts excluded by default.
- Hashes and metadata documented.
- Private deployments can disable external telemetry.

## 22. Documentation Strategy

Audience-specific documentation:

- Administrator guide.
- Analyst guide.
- Incident responder guide.
- Developer/plugin SDK guide.
- API reference.
- CLI reference.
- Deployment guide.
- Security architecture whitepaper.
- Data privacy and telemetry guide.
- Rule authoring guide.
- Remediation safety guide.
- Forensic evidence guide.
- Threat model and hardening guide.

Quality requirements:

- Every detector has public-facing explanation where safe.
- Every API has OpenAPI documentation.
- Every remediation action documents preconditions and rollback.
- Every enterprise deployment has backup/restore and upgrade runbooks.
- Every release has migration notes.

## 23. Remediation Action Catalog

Action types:

- Quarantine file.
- Restore WordPress core file from verified package.
- Restore plugin/theme file from verified source.
- Remove malicious database injection.
- Disable malicious cron entry.
- Remove rogue admin.
- Rotate WordPress salts.
- Rotate database password with customer approval.
- Disable vulnerable plugin.
- Update vulnerable component.
- Harden file permissions.
- Remove malicious .htaccess directive.
- Remove malicious wp-config.php injection.
- Clear caches after cleanup.
- Verify public rendered output.

For every action:

- Preconditions: target exists, evidence captured, backup available where relevant, policy approval.
- Rollback: restore previous file/row/config from evidence vault.
- Failure mode: partial write, permission denied, concurrent site update, incorrect target.
- Verification: re-scan target, validate site health endpoint, compare expected diff.
- Security: avoid executing modified code during action, preserve secrets, audit all changes.

## 24. Explainability Model

Every finding must include:

- What was found.
- Where it was found.
- Why it is suspicious.
- Which detector produced it.
- Detector version and rule/model ID.
- Evidence spans.
- Decoded layers if applicable.
- Source-to-sink path if applicable.
- Related IOCs.
- Related vulnerabilities/components.
- Confidence and severity.
- False-positive considerations.
- Recommended validation.
- Remediation options.
- Impact of doing nothing.
- Impact of remediation.

## 25. Data Retention

Default retention:

- Raw evidence: configurable, default 90 days for SaaS, customer-controlled for private deployments.
- Findings/incidents: default 2 years.
- Audit logs: default 1 year or enterprise policy.
- Telemetry aggregates: default 13 months.
- Deleted tenant data: purge according to contractual policy.

Controls:

- Legal hold.
- Per-site retention policy.
- Evidence export before purge.
- Secure deletion where storage supports it.

## 26. Security Review Requirements

Before implementation:

- Review threat model.
- Review update signing design.
- Review sandbox isolation.
- Review tenant isolation.
- Review evidence chain-of-custody.
- Review remediation safety.
- Review privacy/telemetry design.
- Review plugin SDK sandbox.
- Review cryptography choices.

Before production:

- Third-party penetration test.
- Secure code review.
- Fuzzing burn-in.
- Disaster recovery drill.
- Incident response tabletop.
- Supply-chain security review.

## 27. Build Sequence Recommendation

Phase 1: Core evidence, file scanning, WordPress core verification, signature/YARA/heuristics, dashboard basics, CLI, API, audit, auth.

Phase 2: PHP parser, AST facts, deobfuscation, database forensics, plugin/theme intelligence, vulnerability intelligence, remediation dry-run.

Phase 3: CFG, DFG, taint, web shell specialization, persistence detection, incident correlation, timeline, reporting.

Phase 4: symbolic execution, sandbox behavioral analysis, root cause inference, AI detection, multi-site intelligence, STIX/TAXII, desktop app.

Phase 5: advanced enterprise deployment, private cloud, air-gapped updates, plugin SDK, managed response operations, global telemetry research program.

Rationale:

- Phase 1 provides usable detection and enterprise foundations.
- Phase 2 improves WordPress-specific depth.
- Phase 3 adds forensic and SAST differentiation.
- Phase 4 adds advanced research and response capabilities.
- Phase 5 scales operations and ecosystem extensibility.

## 28. Approval Gate Before Code

Implementation should not begin until stakeholders approve:

- Product scope and release phases.
- Deployment model priorities.
- Language/runtime choices.
- Data privacy posture.
- Telemetry policy.
- Evidence retention policy.
- Rule/model update governance.
- Remediation automation risk thresholds.
- Licensing approach.
- Initial malware benchmark corpus.

