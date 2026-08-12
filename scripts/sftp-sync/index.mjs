import SftpClient from 'ssh2-sftp-client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { SFTP_CREDENTIALS } from './credentials.mjs'

const ACTION = process.env.SFTP_ACTION // 'list' | 'download'
const REMOTE_PATH = process.env.SFTP_REMOTE_PATH // download 模式下的目标文件名（相对于 SFTP_REMOTE_DIR，与 list 模式返回的 listing.json 里的 name 字段一致，不是完整路径）
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

async function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const sftp = new SftpClient()

  try {
    await sftp.connect(SFTP_CONFIG)

    if (ACTION === 'list') {
      const entries = await sftp.list(SFTP_REMOTE_DIR)
      const listing = entries
        .filter((e) => e.type === '-') // 只列普通文件，排除目录
        .map((e) => ({ name: e.name, size: e.size, modifyTime: e.modifyTime }))
      writeFileSync(`${OUTPUT_DIR}/listing.json`, JSON.stringify({ files: listing }, null, 2))
      console.log(`listed ${listing.length} files from ${SFTP_REMOTE_DIR}`)
    } else if (ACTION === 'download') {
      if (!REMOTE_PATH) throw new Error('SFTP_REMOTE_PATH is required for download action')
      const fileName = REMOTE_PATH.split('/').pop()
      const remoteFullPath = `${SFTP_REMOTE_DIR}/${REMOTE_PATH}`
      const buffer = await sftp.get(remoteFullPath)
      writeFileSync(`${OUTPUT_DIR}/${fileName}`, buffer)
      console.log(`downloaded ${remoteFullPath} -> ${OUTPUT_DIR}/${fileName}`)
    } else {
      throw new Error(`unknown SFTP_ACTION: ${ACTION}`)
    }
  } finally {
    await sftp.end()
  }
}

run().catch((err) => {
  console.error('sftp-sync failed:', err)
  process.exit(1)
})
