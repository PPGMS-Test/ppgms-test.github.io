// SFTP 连接参数硬编码在源码中——本项目是展示用 demo，对账数据为 sandbox 测试数据，
// 用户已确认接受此简化（详见 docs/2026-08-11-sftp-reconciliation-sync-design.md）。
export const SFTP_CONFIG = {
  host: 'reports.sandbox.paypal.com',
  port: 22,
  username: 'sftpjg_psp-test-hk02test.com',
  password: 'Pp@test1357',
  readyTimeout: 15000,
}

export const SFTP_REMOTE_DIR = '/ppreports/outgoing'
