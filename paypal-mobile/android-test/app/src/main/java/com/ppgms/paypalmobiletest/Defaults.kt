package com.ppgms.paypalmobiletest

/**
 * 全局默认值. 集中放在一处, 改 sandbox merchant 或换部署地址时只动这里。
 *
 * 安全提示: 真实生产 app 永远不要把 client secret 打包进 APK。这里保留是因为这是
 * 一次性测试 app, 后端 (BACKEND_BASE_URL) 才是真正用 secret 的地方, 客户端用不到。
 */
object Defaults {

    /** PayPal Sandbox 商户的 client ID, 与后端 `SANDBOX_CLIENT_ID` 保持一致。 */
    const val DEFAULT_CLIENT_ID =
        "Aa9Fj_yJs0Ylv2ZxdwWd-5ATa8vNqnn8ykMXksfwk5TRR0zvu1XoTZRhrAvI5YtnyaIJrFSanfQUq-9O"

    /**
     * 对应商户的 client secret. 仅当你要从客户端直接调 PayPal REST 时才用得上,
     * 当前流程 (调后端) 完全用不到。
     */
    const val DEFAULT_CLIENT_SECRET =
        "ELMHpqnP61kMOWIiz0NF-xKTmBXehYcgl6fv5VVJOpe_Usm57VCnjosY0tD78dAVo2CXglhQ4GVJql87"

    /** 已部署的 Next.js 后端地址, 提供 create-order / capture-order 接口。 */
    const val BACKEND_BASE_URL = "https://ppgms-test-github-io.pages.dev"
}
