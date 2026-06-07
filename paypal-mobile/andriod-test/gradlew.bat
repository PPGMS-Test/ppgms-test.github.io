@echo off
setlocal

set APP_HOME=%~dp0
if "%APP_HOME%"=="" set APP_HOME=.

if defined JAVA_HOME (
  set JAVACMD=%JAVA_HOME%\bin\java.exe
) else (
  set JAVACMD=java.exe
)

set DEFAULT_JVM_OPTS=-Dfile.encoding=UTF-8 -Xmx64m -Xms64m

"%JAVACMD%" %DEFAULT_JVM_OPTS% -Dorg.gradle.appname=gradlew -jar "%APP_HOME%gradle\wrapper\gradle-wrapper.jar" %*
exit /b %ERRORLEVEL%
