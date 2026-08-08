-- Add the iOS counterpart to HEALTH_CONNECT. Placed after it so the enum order
-- still reads platform-aggregator first, direct-device sources after.
ALTER TYPE "VitalsProvider" ADD VALUE 'HEALTH_KIT' AFTER 'HEALTH_CONNECT';
