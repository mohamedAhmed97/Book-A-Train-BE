-- Direct Bluetooth LE sensor link (Heart Rate Service 0x180D): chest straps and
-- sports watches in broadcast mode. Placed before MANUAL so the enum still
-- reads platform aggregators first, then direct device sources, then hand entry.
ALTER TYPE "VitalsProvider" ADD VALUE 'BLE' BEFORE 'MANUAL';
