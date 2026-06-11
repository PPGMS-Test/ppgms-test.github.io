package com.ppgms.paypalmobiletest

import android.os.SystemClock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * 后端 HTTP 调用封装。所有请求都是 POST, 后端部署在 [Defaults.BACKEND_BASE_URL]。
 *
 * 暴露两个接口:
 * - [createOrder] → 让后端用样例数据创建一个 PayPal Order, 返回 orderId
 * - [captureOrder] → 用后端凭证去捕获指定 orderId, 返回完整 HTTP 响应
 *
 * 所有方法都是 suspend, 默认切到 IO 线程, 调用方用 lifecycleScope.launch 即可。
 */
data class BackendResponse(
    val statusCode: Int,
    val body: String,
    val durationMs: Long,
    val url: String,
)

class BackendException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

object BackendClient {

    private const val CREATE_PATH = "/api/checkout/orders/create-with-sample-data"
    private fun capturePath(orderId: String) = "/api/checkout/orders/$orderId/capture"

    /**
     * 创建一个样例订单 (100 USD), 解析后端返回的 JSON, 把 `id` 字段抽出来返回。
     * 同时返回原始响应供日志记录。
     */
    suspend fun createOrder(): Pair<String, BackendResponse> = withContext(Dispatchers.IO) {
        val response = post(CREATE_PATH)
        if (response.statusCode !in 200..299) {
            throw BackendException("Create order failed: HTTP ${response.statusCode} — ${response.body}")
        }
        val id = JSONObject(response.body).optString("id", "")
        if (id.isBlank()) {
            throw BackendException("Create order returned no id: ${response.body}")
        }
        id to response
    }

    /**
     * 捕获指定 orderId, 仅返回 HTTP 响应原文给调用方决定怎么展示。
     */
    suspend fun captureOrder(orderId: String): BackendResponse = withContext(Dispatchers.IO) {
        post(capturePath(orderId))
    }

    /**
     * 共通的 POST 请求实现: 用 JDK 自带的 HttpURLConnection, 避免引入 OkHttp 显式依赖
     * (SDK 内部已经传递依赖了 OkHttp, 但保持本类无外部依赖更轻量)。
     */
    private fun post(path: String): BackendResponse {
        val urlString = Defaults.BACKEND_BASE_URL.trimEnd('/') + path
        val url = URL(urlString)
        val connection = url.openConnection() as HttpURLConnection
        val started = SystemClock.elapsedRealtime()
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            // 后端两个接口都接受空 body, 写一个空数组占位即可
            connection.outputStream.use { it.write(ByteArray(0)) }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            val duration = SystemClock.elapsedRealtime() - started
            BackendResponse(statusCode = status, body = body, durationMs = duration, url = urlString)
        } catch (t: Throwable) {
            throw BackendException("Request to $urlString failed: ${t.message}", t)
        } finally {
            connection.disconnect()
        }
    }
}
