# Data model (v1)

Project: id, schemaVersion (1), ownerId (null until accounts exist), name, location, courseType (indoor | outdoor | dry_slope), surfaceType, description, date (YYYY-MM-DD), units (metres | feet), notes, createdAt, updatedAt.

Phase 2 adds Course, Gate and Calibration entities. Every dimension will record its source: entered, calibrated, estimated or unknown.
