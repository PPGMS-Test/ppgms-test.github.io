// SFTP 连接参数硬编码在源码中——本项目是展示用 demo，对账数据为 sandbox 测试数据，
// 用户已确认接受此简化（详见 docs/2026-08-11-sftp-reconciliation-sync-design.md）。
//
// key 必须跟 psp-path-dashboard/src/config/credential-presets.ts 里 CredentialPreset.id 一致，
// 前端按 activePresetId 传下来的字符串在这里查表。

export const SFTP_CREDENTIALS = {
  hkpsp: {
    host: 'reports.sandbox.paypal.com',
    port: 22,
    username: 'sftpw7_HKPSPPP.com',
    password: 'Filma132800@',
    readyTimeout: 15000,
    remoteDir: '/ppreports/outgoing',
  },
  'yuncong-hk-psp1': {
    host: 'reports.sandbox.paypal.com',
    port: 22,
    username: 'sftpjg_psp-test-hk02test.com',
    password: 'Pp@test1357',
    readyTimeout: 15000,
    remoteDir: '/ppreports/outgoing',
  },
}
