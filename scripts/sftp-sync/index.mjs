import SftpClient from 'ssh2-sftp-client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SFTP_CREDENTIALS } from './credentials.mjs'
import { buildListingPayload, todayUtc } from './listing.mjs'

async function run() {
  const ACTION = process.env.SFTP_ACTION // 'list' | 'download'
  // download 模式下的目标文件名（相对于 remoteDir，与 listing.json 里的 name 一致，不是完整路径）
  const REMOTE_PATH = process.env.SFTP_REMOTE_PATH
  const OUTPUT_DIR = process.env.SFTP_OUTPUT_DIR ?? './output'
  const CREDENTIAL_ID = process.env.SFTP_CREDENTIAL_ID

  const credential = SFTP_CREDENTIALS[CREDENTIAL_ID]
  if (!credential) {
    throw new Error(`unknown SFTP_CREDENTIAL_ID: ${CREDENTIAL_ID}`)
  }
  const SFTP_CONFIG = {
    host: credential.host,
    port: credential.port,
    username: credential.username,
    password: credential.password,
    readyTimeout: credential.readyTimeout,
  }
  const SFTP_REMOTE_DIR = credential.remoteDir
  // 产物按凭证分子目录，前端缓存据此天然隔离不同凭证
  const credentialDir = `${OUTPUT_DIR}/${CREDENTIAL_ID}`
  mkdirSync(credentialDir, { recursive: true })

  const sftp = new SftpClient()
  try {
    await sftp.connect(SFTP_CONFIG)

    if (ACTION === 'list') {
      const entries = await sftp.list(SFTP_REMOTE_DIR)
      const payload = buildListingPayload(entries, CREDENTIAL_ID, todayUtc())
      writeFileSync(`${credentialDir}/listing.json`, JSON.stringify(payload, null, 2))
      console.log(`listed ${payload.files.length} files from ${SFTP_REMOTE_DIR}`)
    } else if (ACTION === 'download') {
      if (!REMOTE_PATH) throw new Error('SFTP_REMOTE_PATH is required for download action')
      const fileName = REMOTE_PATH.split('/').pop()
      const remoteFullPath = `${SFTP_REMOTE_DIR}/${REMOTE_PATH}`
      const buffer = await sftp.get(remoteFullPath)
      writeFileSync(`${credentialDir}/${fileName}`, buffer)
      console.log(`downloaded ${remoteFullPath} -> ${credentialDir}/${fileName}`)
    } else {
      throw new Error(`unknown SFTP_ACTION: ${ACTION}`)
    }
  } finally {
    await sftp.end()
  }
}

// 仅当作为脚本直接执行时才连 SFTP；被测试 import 时不触发 run()
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error('sftp-sync failed:', err)
    process.exit(1)
  })
}
