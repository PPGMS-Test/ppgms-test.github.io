给我生成一个单html文件的页面, 不要引入其他框架.  目的是用于测试PayPal的AppSwitch功能

相关文档在这里: >https://developer.paypal.com/docs/checkout/standard/customize/app-switch/js-sdk/

要求, 使用JSSDK来渲染按钮, OrderV2来创建订单

创建订单的地址可以使用这个: https://paypal-backend-api-vercel.vercel.app/api/checkout/orders/create-with-sample-data
capture的地址是这个: https://paypal-backend-api-vercel.vercel.app/api/checkout/{{order_id}}/capture

PayPal测试环境的JS SDK信息如下:
<!-- APP Name: v6-sdk-test -->
<!-- create live account: email_computer@163.com -->
<!-- related  sandbox account: p-test-us-v6-2025@test.com (US Account) -->
PAYPAL_CLIENT_ID= Aa9Fj_yJs0Ylv2ZxdwWd-5ATa8vNqnn8ykMXksfwk5TRR0zvu1XoTZRhrAvI5YtnyaIJrFSanfQUq-9O
PAYPAL_SECRET = ELMHpqnP61kMOWIiz0NF-xKTmBXehYcgl6fv5VVJOpe_Usm57VCnjosY0tD78dAVo2CXglhQ4GVJql87

使用material风格的图标和式样. 