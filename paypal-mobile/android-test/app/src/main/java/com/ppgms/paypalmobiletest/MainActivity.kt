package com.ppgms.paypalmobiletest

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.SystemClock
import android.text.Spannable
import android.text.SpannableString
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.content.res.ResourcesCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.card.MaterialCardView
import com.paypal.android.corepayments.CoreConfig
import com.paypal.android.corepayments.Environment
import com.paypal.android.paymentbuttons.PayPalButton
import com.paypal.android.paymentbuttons.PayPalButtonColor
import com.paypal.android.paymentbuttons.PayPalButtonLabel
import com.paypal.android.paypalwebpayments.PayPalPresentAuthChallengeResult
import com.paypal.android.paypalwebpayments.PayPalWebCheckoutClient
import com.paypal.android.paypalwebpayments.PayPalWebCheckoutFinishStartResult
import com.paypal.android.paypalwebpayments.PayPalWebCheckoutFundingSource
import com.paypal.android.paypalwebpayments.PayPalWebCheckoutRequest
import kotlinx.coroutines.launch

/**
 * 单 Activity 测试 app, 用于演示 PayPal Android Mobile SDK 的完整流程:
 *
 * 1. 用户点击官方/手画按钮 → 调用后端 `create-with-sample-data` 拿到 orderId
 * 2. 把 orderId 传给 [PayPalWebCheckoutClient.start], 拉起 PayPal 浏览器结算
 * 3. 浏览器结算完, 通过 `paypalmobiletest://` 自定义 scheme 回到本 Activity
 * 4. [PayPalWebCheckoutClient.finishStart] 解析结果, 成功后调后端 `capture` 完成订单捕获
 *
 * 所有 UI 都是用代码构建的 (没有 XML layout), 方便单文件追踪。
 * 所有事件 / API 调用 / SDK 回调都会写到底部的 Log 卡片里, 带时间戳和分类 TAG。
 */
class MainActivity : ComponentActivity() {

    // ───── UI 引用 ─────
    private lateinit var rootScroll: ScrollView
    private lateinit var clientIdInput: EditText
    private lateinit var orderIdInput: EditText
    private lateinit var returnSchemeInput: EditText
    private lateinit var environmentSpinner: Spinner
    private lateinit var envBadge: TextView
    private lateinit var officialButton: PayPalButton
    private lateinit var customButton: TextView
    private lateinit var progressRow: View
    private lateinit var logView: TextView

    // ───── 状态 ─────
    private var payPalClient: PayPalWebCheckoutClient? = null
    private var lastHandledReturnUri: String? = null
    private lateinit var logger: Logger

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildContent())
        logger = Logger(logView, rootScroll, this)
        logger.info("App ready. Backend: ${Defaults.BACKEND_BASE_URL}")
        logger.info("Tap a button to auto-create + capture a sample order via the backend.")
        updateEnvBadge()
    }

    override fun onResume() {
        super.onResume()
        handleReturnIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleReturnIntent(intent)
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UI 构建
    // ─────────────────────────────────────────────────────────────────────

    /** 顶层 ScrollView + 垂直 LinearLayout, 里面叠加各张卡片。 */
    private fun buildContent(): View {
        rootScroll = ScrollView(this).apply {
            setBackgroundColor(BG_PAGE)
        }
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(20), dp(16), dp(24))
        }
        rootScroll.addView(
            container,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
        )

        container.addView(buildHeader())
        container.addView(buildConfigCard(), cardLp())
        container.addView(buildSandboxHintCard(), cardLp())
        container.addView(buildCheckoutCard(), cardLp())
        container.addView(buildLogCard(), cardLp())

        return rootScroll
    }

    /** 标题行 + 环境徽章 (SANDBOX / LIVE 上色) + 一行小字副标题。 */
    private fun buildHeader(): View {
        val wrap = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val title = TextView(this).apply {
            text = "PayPal Mobile SDK Test"
            setTextColor(TEXT_PRIMARY)
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
        }
        envBadge = TextView(this).apply {
            text = "SANDBOX"
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            setPadding(dp(10), dp(4), dp(10), dp(4))
            background = pillDrawable(Color.parseColor("#16A34A"))
        }
        row.addView(
            title,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )
        row.addView(envBadge)

        val subtitle = TextView(this).apply {
            text = "Native Android · com.paypal.android:paypal-web-payments + payment-buttons"
            setTextColor(TEXT_MUTED)
            textSize = 12f
            setPadding(0, dp(4), 0, dp(12))
        }
        wrap.addView(row)
        wrap.addView(subtitle)
        return wrap
    }

    /** Configuration 卡片: client ID / order ID / return scheme / 环境下拉 */
    private fun buildConfigCard(): View {
        val card = makeCard()
        val content = card.contentColumn()

        content.addView(sectionTitle("Configuration"))

        clientIdInput = makeInput("Sandbox or Live client ID")
        clientIdInput.setText(Defaults.DEFAULT_CLIENT_ID)
        content.addView(labeledField("Client ID", clientIdInput))

        orderIdInput = makeInput("Auto-filled after backend create")
        content.addView(labeledField("Order ID  (optional — empty = auto-create)", orderIdInput))

        returnSchemeInput = makeInput(getString(R.string.paypal_return_scheme))
        returnSchemeInput.setText(getString(R.string.paypal_return_scheme))
        content.addView(labeledField("Return URL scheme", returnSchemeInput))

        environmentSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_item,
                listOf("Sandbox", "Live")
            ).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
            onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p: android.widget.AdapterView<*>?, v: View?, pos: Int, id: Long) {
                    updateEnvBadge()
                    // Spinner 装 adapter 时会立刻触发一次 onItemSelected(0), 而那时 logger
                    // 还没在 onCreate 里 new 出来 — 加这个守卫避免崩溃
                    if (::logger.isInitialized) {
                        logger.ui("Environment switched to ${if (pos == 1) "LIVE" else "SANDBOX"}")
                    }
                }

                override fun onNothingSelected(p: android.widget.AdapterView<*>?) {}
            }
        }
        content.addView(labeledField("Environment", environmentSpinner))

        return card
    }

    /** Sandbox 买家账号提示卡片 — 不含真实凭证, 只解释格式和管理入口。 */
    private fun buildSandboxHintCard(): View {
        val card = makeCard(Color.parseColor("#152233")) // 略带蓝调, 与默认卡片区分
        val content = card.contentColumn()

        content.addView(sectionTitle("Sandbox Test Buyer"))

        val desc = TextView(this).apply {
            text = "Default client ID is paired with the PayPal Sandbox environment. " +
                "Checkout will ask you to sign in with a sandbox personal account — not a real PayPal account."
            setTextColor(TEXT_MUTED)
            textSize = 13f
            setPadding(0, 0, 0, dp(10))
        }
        content.addView(desc)

        val code = TextView(this).apply {
            text = buildString {
                append("Email format :  sb-xxxxxx@personal.example.com\n")
                append("Password     :  set when the sandbox account was created")
            }
            typeface = Typeface.MONOSPACE
            setTextColor(Color.parseColor("#CBD5E1"))
            textSize = 12f
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = roundedFill(Color.parseColor("#0B1422"), radiusDp = 8)
        }
        content.addView(code)

        val manage = TextView(this).apply {
            text = "Manage sandbox accounts:  developer.paypal.com/dashboard/accounts"
            setTextColor(Color.parseColor("#7DD3FC"))
            textSize = 12f
            setPadding(0, dp(10), 0, 0)
        }
        content.addView(manage)

        return card
    }

    /** Checkout 卡片: 官方 SDK 按钮 + 手画按钮 (作风格对比), 共享同一个 startCheckout. */
    private fun buildCheckoutCard(): View {
        val card = makeCard()
        val content = card.contentColumn()

        content.addView(sectionTitle("Checkout"))

        content.addView(subLabel("Official SDK button  (com.paypal.android:payment-buttons)"))
        officialButton = PayPalButton(this).apply {
            color = PayPalButtonColor.GOLD
            label = PayPalButtonLabel.CHECKOUT
            setOnClickListener {
                logger.ui("Official PayPalButton tapped")
                startCheckout()
            }
        }
        content.addView(
            officialButton,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(4) }
        )

        content.addView(subLabel("Hand-drawn button  (this app — for visual comparison)"))
        customButton = buildCustomButton().apply {
            setOnClickListener {
                logger.ui("Hand-drawn button tapped")
                startCheckout()
            }
        }
        content.addView(
            customButton,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
            ).apply { topMargin = dp(4) }
        )

        // 行内进度条 — 后端请求期间显示, 完成后隐藏
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            visibility = View.GONE
        }
        val spinner = ProgressBar(this).apply {
            val size = dp(18)
            layoutParams = LinearLayout.LayoutParams(size, size)
        }
        val progressLabel = TextView(this).apply {
            text = "  Talking to backend…"
            setTextColor(TEXT_MUTED)
            textSize = 12f
        }
        row.addView(spinner)
        row.addView(progressLabel)
        progressRow = row
        content.addView(
            row,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = dp(10) }
        )

        return card
    }

    /** Log 卡片: 标题栏 + Clear 按钮 + 内部 ScrollView (限制最大高度, 不无限拉伸主页面)。 */
    private fun buildLogCard(): View {
        val card = makeCard(Color.parseColor("#0F1825"))
        val content = card.contentColumn()

        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        headerRow.addView(
            sectionTitle("Activity Log"),
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )
        val clearBtn = TextView(this).apply {
            text = "Clear"
            setTextColor(Color.parseColor("#7DD3FC"))
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(10), dp(6), dp(10), dp(6))
            isClickable = true
            isFocusable = true
            background = roundedFill(Color.parseColor("#19273C"), radiusDp = 6)
            setOnClickListener {
                logger.clear()
                logger.ui("Log cleared")
            }
        }
        headerRow.addView(clearBtn)
        content.addView(headerRow)

        // 不嵌套 ScrollView (会和外层抢手势), 直接让 logView 顺着外层 scroll 增长
        logView = TextView(this).apply {
            setTextColor(Color.parseColor("#D9E1F2"))
            textSize = 12f
            typeface = Typeface.MONOSPACE
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = roundedFill(Color.parseColor("#070C14"), radiusDp = 8)
        }
        content.addView(
            logView,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = dp(10) }
        )

        return card
    }

    // ─────────────────────────────────────────────────────────────────────
    //  事件处理
    // ─────────────────────────────────────────────────────────────────────

    /**
     * 主流程入口: 校验输入 → 后端建单 → SDK 拉起结算。
     * 期间禁用两个按钮 + 显示 ProgressBar, 全部事件写日志。
     */
    private fun startCheckout() {
        val clientId = clientIdInput.text.toString().trim()
        val returnScheme = returnSchemeInput.text.toString().trim()
        val envIndex = environmentSpinner.selectedItemPosition
        val environment = if (envIndex == 1) Environment.LIVE else Environment.SANDBOX

        if (clientId.isBlank() || returnScheme.isBlank()) {
            logger.err("Client ID and return scheme are required.")
            return
        }

        val manualOrderId = orderIdInput.text.toString().trim()
        setBusy(true)

        lifecycleScope.launch {
            val orderId = if (manualOrderId.isNotBlank()) {
                logger.info("Using manually entered order ID $manualOrderId (skipping backend create).")
                manualOrderId
            } else {
                logger.api("→ POST ${Defaults.BACKEND_BASE_URL}$CREATE_PATH_LOG")
                val t0 = SystemClock.elapsedRealtime()
                try {
                    val (id, resp) = BackendClient.createOrder()
                    logger.api("← HTTP ${resp.statusCode} in ${resp.durationMs}ms, orderId=$id")
                    orderIdInput.setText(id)
                    id
                } catch (t: Throwable) {
                    val dt = SystemClock.elapsedRealtime() - t0
                    logger.err("Create order failed (${dt}ms): ${t.message}")
                    setBusy(false)
                    return@launch
                }
            }

            launchSdk(clientId, returnScheme, environment, orderId)
            setBusy(false)
        }
    }

    /** 实际调 SDK 拉起浏览器结算。 */
    private fun launchSdk(
        clientId: String,
        returnScheme: String,
        environment: Environment,
        orderId: String,
    ) {
        val coreConfig = CoreConfig(clientId = clientId, environment = environment)
        val client = PayPalWebCheckoutClient(this, coreConfig, returnScheme)
        payPalClient = client
        lastHandledReturnUri = null

        logger.sdk("Built PayPalWebCheckoutClient (env=${environment.name}, scheme=$returnScheme)")
        logger.sdk("client.start(orderId=$orderId, funding=PAYPAL)")

        val request = PayPalWebCheckoutRequest(
            orderId = orderId,
            fundingSource = PayPalWebCheckoutFundingSource.PAYPAL,
        )

        client.start(this, request) { startResult ->
            when (startResult) {
                is PayPalPresentAuthChallengeResult.Success -> {
                    logger.sdk("PayPalPresentAuthChallengeResult.Success — browser switch started")
                }

                is PayPalPresentAuthChallengeResult.Failure -> {
                    logger.err("PayPalPresentAuthChallengeResult.Failure — ${startResult.error.errorDescription}")
                }
            }
        }
    }

    /**
     * 浏览器结算完, 系统通过 `<intent-filter>` 把 paypalmobiletest:// URI 派回来。
     * 这里要去重 (onResume + onNewIntent 都会触发), 然后让 SDK 把 URI 解析成结果。
     */
    private fun handleReturnIntent(intent: Intent) {
        val client = payPalClient ?: return
        val data = intent.data ?: return
        val currentScheme = returnSchemeInput.text.toString().trim()
        if (currentScheme.isBlank() || data.scheme != currentScheme) return

        val incomingUri = data.toString()
        if (incomingUri == lastHandledReturnUri) return
        lastHandledReturnUri = incomingUri

        logger.sdk("Return intent received: $incomingUri")

        when (val finishResult = client.finishStart(intent)) {
            is PayPalWebCheckoutFinishStartResult.Success -> {
                logger.sdk("finishStart → Success  orderId=${finishResult.orderId}, payerId=${finishResult.payerId}")
                captureViaBackend(finishResult.orderId)
            }

            is PayPalWebCheckoutFinishStartResult.Failure -> {
                logger.err("finishStart → Failure  ${finishResult.error.errorDescription}")
            }

            is PayPalWebCheckoutFinishStartResult.Canceled -> {
                logger.sdk("finishStart → Canceled (user backed out)")
            }

            PayPalWebCheckoutFinishStartResult.NoResult -> {
                logger.sdk("finishStart → NoResult")
            }

            else -> {
                logger.sdk("finishStart → unknown result")
            }
        }
    }

    /** SDK 返回 Success 之后, 调后端 capture 真正扣款。 */
    private fun captureViaBackend(orderId: String) {
        lifecycleScope.launch {
            logger.api("→ POST ${Defaults.BACKEND_BASE_URL}/api/checkout/orders/$orderId/capture")
            setBusy(true)
            try {
                val response = BackendClient.captureOrder(orderId)
                logger.api("← HTTP ${response.statusCode} in ${response.durationMs}ms")
                logger.info("Capture body: ${response.body}")
            } catch (t: Throwable) {
                logger.err("Capture failed: ${t.message}")
            } finally {
                setBusy(false)
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UI 辅助
    // ─────────────────────────────────────────────────────────────────────

    /** 禁用/启用两个支付按钮, 同步显隐 ProgressBar 行。 */
    private fun setBusy(busy: Boolean) {
        officialButton.isEnabled = !busy
        customButton.isEnabled = !busy
        progressRow.visibility = if (busy) View.VISIBLE else View.GONE
    }

    /** 根据下拉框当前值刷新右上角徽章颜色 + 文字。 */
    private fun updateEnvBadge() {
        if (!::envBadge.isInitialized) return
        val isLive = environmentSpinner.selectedItemPosition == 1
        envBadge.text = if (isLive) "LIVE" else "SANDBOX"
        envBadge.background = pillDrawable(if (isLive) Color.parseColor("#DC2626") else Color.parseColor("#16A34A"))
    }

    /** 手画按钮 — 与官方 PayPalButton 风格对比用, 故意做成深蓝 + 虚线描边。 */
    private fun buildCustomButton(): TextView {
        val label = SpannableString("Pay with PayPal  (custom-drawn)")
        label.setSpan(ForegroundColorSpan(Color.WHITE), 0, 17, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
        label.setSpan(StyleSpan(Typeface.BOLD), 8, 14, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
        label.setSpan(StyleSpan(Typeface.ITALIC), 8, 14, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
        label.setSpan(
            ForegroundColorSpan(Color.parseColor("#FFC439")),
            17,
            label.length,
            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
        return TextView(this).apply {
            text = label
            textSize = 15f
            gravity = Gravity.CENTER
            isClickable = true
            isFocusable = true
            background = ResourcesCompat.getDrawable(resources, R.drawable.bg_paypal_button, theme)
        }
    }

    // ───── 小工具: 卡片 / 输入框 / 标签 / 圆角背景 ─────

    /** 新建一张 Material 卡片, 默认深灰底, 调用方可覆盖颜色。 */
    private fun makeCard(bg: Int = Color.parseColor("#161D2B")): MaterialCardView {
        return MaterialCardView(this).apply {
            radius = dp(16).toFloat()
            cardElevation = 0f
            setCardBackgroundColor(bg)
            strokeWidth = dp(1)
            strokeColor = Color.parseColor("#1F2A3F")
        }
    }

    /** 给卡片加上内部竖排 LinearLayout 并返回, 用于继续 addView. */
    private fun MaterialCardView.contentColumn(): LinearLayout {
        val col = LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(18))
        }
        addView(col)
        return col
    }

    /** 卡片之间的间距 layout params. */
    private fun cardLp(): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = dp(12) }
    }

    /** 卡片内顶部的大标题. */
    private fun sectionTitle(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            setTextColor(TEXT_PRIMARY)
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, dp(10))
        }
    }

    /** 卡片内的小一号副标签 (用于按钮分组). */
    private fun subLabel(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            setTextColor(TEXT_MUTED)
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(10), 0, dp(6))
        }
    }

    /** 输入框上方的 label + 输入控件本身, 包成一个竖排容器返回. */
    private fun labeledField(label: String, field: View): View {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, dp(10))
        }
        col.addView(
            TextView(this).apply {
                text = label
                setTextColor(TEXT_LABEL)
                textSize = 11f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, 0, 0, dp(4))
            }
        )
        col.addView(
            field,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
        )
        return col
    }

    /** 单行 EditText, 深底 + 圆角. */
    private fun makeInput(hint: String): EditText {
        return EditText(this).apply {
            setTextColor(Color.WHITE)
            setHintTextColor(Color.parseColor("#64748B"))
            this.hint = hint
            textSize = 14f
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = roundedFill(Color.parseColor("#0B1422"), radiusDp = 10)
        }
    }

    /** 通用圆角矩形纯色背景. */
    private fun roundedFill(color: Int, radiusDp: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(radiusDp).toFloat()
            setColor(color)
        }
    }

    /** 半圆角胶囊背景, 用于环境徽章. */
    private fun pillDrawable(color: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(999).toFloat()
            setColor(color)
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        // 颜色常量集中放, 改主题时一处搞定
        private val BG_PAGE = Color.parseColor("#0A0F1A")
        private val TEXT_PRIMARY = Color.parseColor("#F8FAFC")
        private val TEXT_MUTED = Color.parseColor("#94A3B8")
        private val TEXT_LABEL = Color.parseColor("#A9B4C7")

        // 仅用于日志显示, 真值在 BackendClient 里
        private const val CREATE_PATH_LOG = "/api/checkout/orders/create-with-sample-data"
    }
}
