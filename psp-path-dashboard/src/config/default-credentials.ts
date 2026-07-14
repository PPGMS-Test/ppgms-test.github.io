// 默认 PSP sandbox 账号（HKPSP）。
//
// 说明：
// - 这是「预填值」，方便打开演练台就能直接跑，不用每次手输。凭证页仍可覆盖/清空。
// - 有意用 config 文件而非 env / gitignore —— 让默认值随仓库走。⚠️ 因此这些值会被提交，
//   仅限 sandbox 使用；切勿在此放 live / 生产凭证。
// - 只放 API 演练台用得到的字段。账号登录密码、SFTP 凭证与本工具无关，故意不放这里。
//
// 字段来源：
//   clientId/clientSecret/bnCode = PSP sandbox 账号 HKPSP 自己的 BYOK 凭证
//   DEFAULT_PAYEE_EMAIL / DEFAULT_PAYER_ID = 下游商户的占位标识（见各自注释），
//     跟上面 HKPSP 账号本身无关，也不涉及"PSP 自己的 payer_id"这个概念——本演练台用不到它。

export const DEFAULT_CREDENTIALS = {
  clientId:
    'AULEbStcvqq5CAJp4_pjORKKqSKaS5vQDyNbOdi4pdQZEOoR6fKV8jlRgrWJAD-jFwZ4oG8SyWdAbCT7',
  clientSecret:
    'EAz1mD-cXy5rVe_DUfKmhZ6ZicGAQqqTfhLKO7xalTBV_1zniHdEwAsIPLcQVaBcQCFYf5bY3ojY0C9l',
  bnCode: 'HKPSP',
}

/**
 * Create Order 里 payee.email_address 的默认值——标识「下游商户」（PSP 代表其收款）。
 * 跟 DEFAULT_PAYER_ID 指的是同一个下游商户，只是用邮箱而非 Payer ID 这种方式标识。
 * 真实值应是商户完成 Partner Referral 授权后的账号邮箱；这里只是占位，凭证/请求预览里可改。
 */
export const DEFAULT_PAYEE_EMAIL = 'psp-test-2026-hk@test.com'

/**
 * PayPal-Auth-Assertion 里 payer_id 字段的默认值——标识的也是「下游商户」，跟 DEFAULT_PAYEE_EMAIL
 * 是同一个商户，只是用 Payer ID 而非邮箱这种方式标识。不是 PSP 自己的 Payer ID——「PSP 自己的
 * payer_id」这个概念在本演练台里完全用不到。真实值要商户完成 Partner Referral 授权后才能从 PayPal
 * 拿到；这里只是占位值，方便没有真实商户时也能跑通请求，请替换成真实下游商户的 Payer ID。
 */
export const DEFAULT_PAYER_ID = 'CAWH8CFWQKULW'

