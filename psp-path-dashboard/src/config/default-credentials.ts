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
//   Payer ID   = WYFHZPJBHKKYU（账号的 PayPal Merchant ID；当前流程用 payee.email_address，未直接使用，留作参考）

export const DEFAULT_CREDENTIALS = {
  clientId:
    'AULEbStcvqq5CAJp4_pjORKKqSKaS5vQDyNbOdi4pdQZEOoR6fKV8jlRgrWJAD-jFwZ4oG8SyWdAbCT7',
  clientSecret:
    'EAz1mD-cXy5rVe_DUfKmhZ6ZicGAQqqTfhLKO7xalTBV_1zniHdEwAsIPLcQVaBcQCFYf5bY3ojY0C9l',
  bnCode: 'HKPSP',
}

/** Create Order 的默认 payee（被授权商户）email。凭证/请求预览里可改。 */
export const DEFAULT_PAYEE_EMAIL = 'HKPSP@PP.com'

/** 账号的 PayPal Merchant/Payer ID，留作参考；当前 create order 用 email 而非 merchant_id。 */
export const DEFAULT_PAYER_ID = 'WYFHZPJBHKKYU'
