// 纯函数模块：不 import ssh2-sftp-client，便于用 node:test 在无 node_modules 环境下测试

/** 返回 UTC 的 YYYY-MM-DD */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

/** 从 sftp.list 结果构造 listing.json 负载：只留普通文件，附带 generatedAt/credentialId */
export function buildListingPayload(entries, credentialId, dateStr) {
  const files = entries
    .filter((e) => e.type === '-') // 只列普通文件，排除目录
    .map((e) => ({ name: e.name, size: e.size, modifyTime: e.modifyTime }))
  return { generatedAt: dateStr, credentialId, files }
}
