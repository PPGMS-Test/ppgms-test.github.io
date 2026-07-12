// 默认 PSP sandbox 账号（HKPSP）。
//
// 说明：
// - 这是「预填值」，方便打开演练台就能直接跑，不用每次手输。凭证页仍可覆盖/清空。
// - 有意用 config 文件而非 env / gitignore —— 让默认值随仓库走。⚠️ 因此这些值会被提交，
//   仅限 sandbox 使用；切勿在此放 live / 生产凭证。
// - 只放 API 演练台用得到的字段。账号登录密码、SFTP 凭证与本工具无关，故意不放这里。
//
// 字段来源（PSP sandbox 账号 HKPSP）：
//   API Caller = HKPSP@PP.com（即默认 payee email）
//   Payer ID   = WYFHZPJBHKKYU（HKPSP 自己账号的 PayPal Merchant ID，不是下游商户的）

export const DEFAULT_CREDENTIALS = {
  clientId:
    'AULEbStcvqq5CAJp4_pjORKKqSKaS5vQDyNbOdi4pdQZEOoR6fKV8jlRgrWJAD-jFwZ4oG8SyWdAbCT7',
  clientSecret:
    'EAz1mD-cXy5rVe_DUfKmhZ6ZicGAQqqTfhLKO7xalTBV_1zniHdEwAsIPLcQVaBcQCFYf5bY3ojY0C9l',
  bnCode: 'HKPSP',
}

/** Create Order 的默认 payee（被授权商户）email。凭证/请求预览里可改。 */
export const DEFAULT_PAYEE_EMAIL = 'HKPSP@PP.com'

/**
 * PayPal-Auth-Assertion 里 payer_id 字段的默认值——语义上应是 PSP 代表的「下游商户」的 Payer ID，
 * 不是 PSP 自己的。真实值要商户完成 Partner Referral 授权后才能拿到；这里预填 HKPSP 自己账号的
 * Payer ID 仅作占位，方便没有真实商户时也能跑通请求。
 */
export const DEFAULT_PAYER_ID = 'WYFHZPJBHKKYU'
