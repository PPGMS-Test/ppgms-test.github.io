// SFTP 连接参数硬编码在源码中——本项目是展示用 demo，对账数据为 sandbox 测试数据，
// 用户已确认接受此简化（详见 docs/2026-08-11-sftp-reconciliation-sync-design.md）。
export const SFTP_CONFIG = {
  host: 'REPLACE_WITH_ACTUAL_SFTP_HOST',
  port: 22,
  username: 'REPLACE_WITH_ACTUAL_USERNAME',
  password: 'REPLACE_WITH_ACTUAL_PASSWORD',
  readyTimeout: 15000,
}

export const SFTP_REMOTE_DIR = 'REPLACE_WITH_ACTUAL_REMOTE_DIR'
