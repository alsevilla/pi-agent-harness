# devops-specialist topic reference

Reference guidance only; the current role, candidate authority and AGENTS policy govern. Search headings and read the task-relevant section; do not load the whole catalog.

## Raspberry Pi / Linux

Understand and consider:

- systemd
- systemd service units
- service dependencies
- restart policies
- watchdogs
- journald
- Unix permissions
- users and groups
- udev rules
- USB device permissions
- filesystem ownership
- environment files
- shell scripts
- signals
- SIGTERM/SIGINT handling
- graceful shutdown
- package installation
- architecture differences such as ARM64 vs x86_64
- Linux filesystem conventions
- log rotation
- scheduled jobs
- networking
- firewall configuration

## Windows NUC

Understand and consider:

- Windows Services
- Service Control Manager
- automatic service startup
- service recovery/restart policies
- Windows service accounts
- Windows permissions and ACLs
- USB device behavior
- COM ports where applicable
- HID devices
- Windows device enumeration
- environment variables
- Windows filesystem paths
- PowerShell
- Task Scheduler where appropriate
- Windows Event Log
- application logs
- graceful service shutdown
- process supervision
- Windows Defender / firewall implications
- x86_64 architecture
- installer/deployment packaging
- service upgrades
- rollback
- reboot recovery

Do not recommend systemd instructions for Windows deployments.

Do not recommend Windows-specific mechanisms for Raspberry Pi/Linux deployments.

---

# Cross-Platform Responsibility

Where possible, application behavior should remain platform-independent.

Keep platform-specific behavior isolated.

Prefer:

application/domain logic
→ cross-platform Rust

platform integration
→ small Linux/Windows-specific boundary

Avoid scattering operating-system checks throughout business logic.

When platform-specific behavior is required, clearly identify it.

---

# Production Reliability

Focus on:

- service startup
- automatic restart
- crash recovery
- graceful shutdown
- configuration
- secrets
- filesystem permissions
- USB permissions
- networking
- ports
- logging
- disk usage
- SQLite storage
- backups
- restore procedures
- WAL checkpointing
- deployment
- upgrades
- rollback
- health checks
- production diagnostics

---

# Startup and Restart

For every deployment consider:

1. Does the application automatically start after reboot?
2. What happens after an application crash?
3. Is restart automatic?
4. Can repeated crashes cause an uncontrolled restart loop?
5. Are dependencies ready before the application starts?
6. What happens when required hardware is unavailable?
7. Can the application recover when hardware later becomes available?

For Linux, evaluate appropriate systemd configuration.

For Windows, evaluate Windows Service recovery configuration or the selected process supervision mechanism.

---

# Graceful Shutdown

Applications must handle operating-system shutdown and service termination safely.

Consider:

- stopping new work;
- finishing or safely abandoning in-flight operations;
- database transaction completion;
- worker shutdown;
- channel shutdown;
- USB reader shutdown;
- SQLite connection closure;
- queued work persistence.

Linux implementations should correctly handle relevant Unix termination signals.

Windows implementations should correctly handle Windows Service stop/shutdown events when running as a service.

Do not assume process termination is always graceful.

Design persistent state so unexpected termination does not corrupt application behavior.

---

# Power Loss

For Raspberry Pi and Windows NUC deployments consider sudden power loss.

Analyze:

- SQLite durability;
- WAL state;
- partially completed operations;
- queue recovery;
- filesystem behavior;
- startup recovery;
- hardware reinitialization.

Do not rely exclusively on graceful shutdown for correctness.

---

# USB / RFID Devices

The application may depend on locally connected USB RFID readers.

Consider platform differences in:

- device discovery;
- permissions;
- identifiers;
- enumeration;
- reconnect behavior;
- driver requirements;
- serial/COM naming;
- HID access.

Linux may require:

- user/group configuration;
- udev rules;
- device permissions.

Windows may require:

- drivers;
- COM configuration;
- device interface discovery;
- service-account access to hardware.

Coordinate hardware behavior with `hardware-integration`.

Do not embed fragile platform-specific device paths directly into domain logic.

---

# SQLite Operations

SQLite may be used as the local production database.

Consider:

- database file location;
- WAL files;
- SHM files;
- filesystem permissions;
- locking;
- backups;
- restore;
- checkpoints;
- disk capacity;
- application shutdown;
- application restart;
- antivirus interactions where relevant;
- network filesystem hazards.

Prefer storing SQLite on a local filesystem.

Do not place the active SQLite database on a network share unless the architecture has explicitly been validated for that environment.

Coordinate database decisions with `sqlite-specialist`.

---

# Backup Strategy

A backup strategy must define:

- what is backed up;
- how it is backed up;
- where backups are stored;
- backup frequency;
- retention;
- failure detection;
- restoration procedure.

A backup strategy is incomplete without restore planning.

For important deployments, backups should not exist solely on the same physical storage device as the production database.

Possible destinations may include:

- external USB storage;
- another machine;
- controlled network storage;
- approved remote storage.

Do not assume cloud connectivity exists.

---

# Restore Strategy

Document how an operator restores service after database loss or corruption.

Consider:

1. Stop application.
2. Preserve damaged data when useful for investigation.
3. Select known-good backup.
4. Restore database safely.
5. Validate integrity.
6. Restart application.
7. Verify health.
8. Verify critical background processing.

Restore procedures should be testable.

---

# Storage Exhaustion

Consider what happens when disk space becomes low or completely exhausted.

Potential consequences include:

- SQLite write failures;
- WAL growth;
- failed backups;
- failed logs;
- queue failures;
- application crashes.

Coordinate monitoring requirements with `observability-specialist`.

---

# Configuration

Configuration must distinguish:

- development;
- testing;
- production.

Do not hardcode machine-specific paths unnecessarily.

Support platform-appropriate paths.

Avoid assuming Unix path syntax on Windows.

Avoid assuming Windows drive letters on Linux.

Configuration errors should fail clearly when continued operation would be unsafe.

---

# Secrets

Never commit production secrets.

Consider appropriate platform-specific secret storage and permissions.

Linux may use protected environment/configuration files or an approved secret mechanism.

Windows may use appropriately protected service configuration, environment configuration, Windows credential facilities, or another approved secret mechanism.

Coordinate sensitive configuration with `security-specialist`.

---

# Permissions

Follow least privilege.

## Linux

Prefer a dedicated service user where practical.

Grant only required:

- database directory access;
- configuration access;
- log access;
- USB/device access.

Avoid running as root unless genuinely required.

## Windows

Prefer an appropriately restricted service account.

Grant only required:

- application directory access;
- database directory access;
- configuration access;
- logs;
- USB/device access;
- network resources when necessary.

Avoid running as Administrator unless genuinely required.

---

# Deployment

Deployment plans should specify:

- artifact being deployed;
- supported CPU architecture;
- configuration;
- required runtime dependencies;
- database migration behavior;
- service installation;
- service restart;
- verification;
- rollback.

For Rust applications, prefer reproducible release builds.

Ensure binaries are compiled for the correct platform and CPU architecture.

Examples include:

- Linux ARM64 for appropriate Raspberry Pi deployments;
- Windows x86_64 for typical Intel/AMD NUC deployments.

Never assume binaries are portable across operating systems or CPU architectures.

---

# Upgrade Safety

Before production upgrades consider:

- application compatibility;
- database migrations;
- configuration changes;
- rollback compatibility;
- service downtime;
- queued jobs;
- connected hardware.

Do not perform irreversible database migrations without explicit consideration of rollback and backup.

---

# Rollback

Every significant production upgrade should answer:

"What happens if the new version fails?"

Where appropriate define:

- previous application version;
- previous configuration;
- database compatibility;
- backup point;
- rollback steps;
- verification steps.

---

# Logging and Diagnostics

Production operators must be able to determine why the service failed.

Linux deployments may use:

- structured application logs;
- journald;
- appropriate log rotation.

Windows deployments may use:

- structured application logs;
- Windows Event Log where appropriate;
- managed log files.

Coordinate signal design with `observability-specialist`.

Avoid logging secrets or unnecessary personal data.

---

# Health Checks

Consider health signals for:

- application process;
- database;
- USB/RFID readers;
- background workers;
- SMS processing;
- storage capacity;
- backups;
- external dependencies.

A running process is not necessarily a healthy application.

---

# Platform Parity

When the application supports both Raspberry Pi/Linux and Windows NUC, explicitly identify differences in:

- startup;
- shutdown;
- device access;
- filesystem paths;
- permissions;
- logging;
- service management;
- backup scheduling;
- upgrades.

Business behavior should remain consistent across platforms.

Platform-specific infrastructure should not alter domain rules.

---

# Failure Analysis

For operational changes ask:

1. What happens after reboot?
2. What happens after application crash?
3. What happens after power loss?
4. What happens if storage fills?
5. What happens if configuration is invalid?
6. What happens if the database cannot open?
7. What happens if an RFID reader disconnects?
8. What happens if networking disappears?
9. What happens if an external service is unavailable?
10. How does the operator know something failed?
11. How is service recovered?
12. How is the previous version restored?

---

# Collaboration

Coordinate with:

`sqlite-specialist`
for SQLite, WAL, backups, locking, and database operational safety.

`hardware-integration`
for USB/RFID lifecycle, drivers, discovery, and reconnect behavior.

`concurrency-specialist`
for shutdown, worker lifecycle, channels, async behavior, and background processing.

`observability-specialist`
for logs, metrics, health checks, diagnostics, and alerts.

`security-specialist`
for secrets, permissions, service accounts, and privilege boundaries.

`backend-worker`
for backend service implementation.

`general-worker`
for tooling, scripts and config implementation.

`frontend-worker`
for frontend UI implementation.

`reviewer`
for high-risk production changes.

---

# Output Expectations

When providing operational recommendations report:

1. Target platform.
2. Assumptions.
3. Deployment changes.
4. Configuration changes.
5. Service/process management.
6. Permissions.
7. Backup/restore impact.
8. Failure/recovery behavior.
9. Verification steps.
10. Rollback strategy.
11. Remaining operational risks.

If supporting both Windows and Linux, clearly distinguish platform-specific instructions.

Never pretend an operational procedure has been tested when it has not.
