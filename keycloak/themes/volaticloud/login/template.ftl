<#import "footer.ftl" as loginFooter>
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}" lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
    <#-- Load parent theme styles -->
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#-- Load Google Fonts for Avenir-like fallback -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --vc-font-family: 'Nunito Sans', 'Avenir', 'Segoe UI', system-ui, -apple-system, sans-serif;
        }
    </style>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <script src="${url.resourcesPath}/js/menu-button-links.js" type="module"></script>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module">
        import { startSessionPolling } from "${url.resourcesPath}/js/authChecker.js";
        startSessionPolling("${url.ssoLoginInOtherTabsUrl?no_esc}");
    </script>
    <script type="module">
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-once-link]");
            if (!link) return;
            if (link.getAttribute("aria-disabled") === "true") {
                event.preventDefault();
                return;
            }
            const { disabledClass } = link.dataset;
            if (disabledClass) {
                link.classList.add(...disabledClass.trim().split(/\s+/));
            }
            link.setAttribute("role", "link");
            link.setAttribute("aria-disabled", "true");
        });
    </script>
    <#if authenticationSession??>
        <script type="module">
            import { checkAuthSession } from "${url.resourcesPath}/js/authChecker.js";
            checkAuthSession("${authenticationSession.authSessionIdHash}");
        </script>
    </#if>
</head>

<body class="${properties.kcBodyClass!}" data-page-id="login-${pageId}">
<div class="${properties.kcLoginClass!}">
    <#-- Hidden header for accessibility -->
    <div id="kc-header" class="${properties.kcHeaderClass!}" style="display:none;">
        <div id="kc-header-wrapper" class="${properties.kcHeaderWrapperClass!}">${kcSanitize(msg("loginTitleHtml",(realm.displayNameHtml!'')))?no_esc}</div>
    </div>

    <#-- Left Panel: Form Card -->
    <div class="${properties.kcFormCardClass!}">
        <#-- Logo -->
        <div class="volaticloud-logo">
            <img src="${url.resourcesPath}/img/logo.svg" alt="VolatiCloud" />
        </div>

        <#-- Locale Selector -->
        <#if realm.internationalizationEnabled && locale.supported?size gt 1>
            <div class="${properties.kcLocaleMainClass!}" id="kc-locale">
                <div id="kc-locale-wrapper" class="${properties.kcLocaleWrapperClass!}">
                    <div id="kc-locale-dropdown" class="menu-button-links ${properties.kcLocaleDropDownClass!}">
                        <button tabindex="1" id="kc-current-locale-link" aria-label="${msg("languages")}" aria-haspopup="true" aria-expanded="false" aria-controls="language-switch1">${locale.current}</button>
                        <ul role="menu" tabindex="-1" aria-labelledby="kc-current-locale-link" aria-activedescendant="" id="language-switch1" class="${properties.kcLocaleListClass!}">
                            <#assign i = 1>
                            <#list locale.supported as l>
                                <li class="${properties.kcLocaleListItemClass!}" role="none">
                                    <a role="menuitem" id="language-${i}" class="${properties.kcLocaleItemClass!}" href="${l.url}">${l.label}</a>
                                </li>
                                <#assign i++>
                            </#list>
                        </ul>
                    </div>
                </div>
            </div>
        </#if>

        <header class="${properties.kcFormHeaderClass!}">
            <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
                <#if displayRequiredFields>
                    <div class="${properties.kcContentWrapperClass!}">
                        <div class="${properties.kcLabelWrapperClass!} subtitle">
                            <span class="subtitle"><span class="required">*</span> ${msg("requiredFields")}</span>
                        </div>
                        <div>
                            <h1 id="kc-page-title"><#nested "header"></h1>
                        </div>
                    </div>
                <#else>
                    <h1 id="kc-page-title"><#nested "header"></h1>
                </#if>
            <#else>
                <#if displayRequiredFields>
                    <div class="${properties.kcContentWrapperClass!}">
                        <div class="${properties.kcLabelWrapperClass!} subtitle">
                            <span class="subtitle"><span class="required">*</span> ${msg("requiredFields")}</span>
                        </div>
                        <div>
                            <#nested "show-username">
                            <div id="kc-username" class="${properties.kcFormGroupClass!}">
                                <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                                <a id="reset-login" href="${url.loginRestartFlowUrl}" aria-label="${msg("restartLoginTooltip")}">
                                    <div class="kc-login-tooltip">
                                        <i class="${properties.kcResetFlowIcon!}"></i>
                                        <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>
                <#else>
                    <#nested "show-username">
                    <div id="kc-username" class="${properties.kcFormGroupClass!}">
                        <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                        <a id="reset-login" href="${url.loginRestartFlowUrl}" aria-label="${msg("restartLoginTooltip")}">
                            <div class="kc-login-tooltip">
                                <i class="${properties.kcResetFlowIcon!}"></i>
                                <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
                            </div>
                        </a>
                    </div>
                </#if>
            </#if>
        </header>

        <#-- Subtitle for registration page -->
        <#if pageId == "register.ftl">
            <p class="volaticloud-subtitle">Kindly fill in your details below to create an account</p>
        <#elseif pageId == "login.ftl">
            <p class="volaticloud-subtitle">Sign in to your account</p>
        </#if>

        <div id="kc-content">
            <div id="kc-content-wrapper">
                <#-- Alert messages -->
                <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                    <div class="pf-c-alert pf-m-inline <#if message.type = 'success'>pf-m-success</#if><#if message.type = 'warning'>pf-m-warning</#if><#if message.type = 'error'>pf-m-danger</#if><#if message.type = 'info'>pf-m-info</#if>" aria-label="${message.type}">
                        <div class="pf-c-alert__icon">
                            <#if message.type = 'success'><i class="${properties.kcFeedbackSuccessIcon!}" aria-hidden="true"></i></#if>
                            <#if message.type = 'warning'><i class="${properties.kcFeedbackWarningIcon!}" aria-hidden="true"></i></#if>
                            <#if message.type = 'error'><i class="${properties.kcFeedbackErrorIcon!}" aria-hidden="true"></i></#if>
                            <#if message.type = 'info'><i class="${properties.kcFeedbackInfoIcon!}" aria-hidden="true"></i></#if>
                        </div>
                        <h4 class="${properties.kcAlertTitleClass!}">
                            <span class="pf-screen-reader">${message.type}</span>
                            ${kcSanitize(message.summary)?no_esc}
                        </h4>
                    </div>
                </#if>

                <#-- Main form content -->
                <#nested "form">

                <#-- Try another way link -->
                <#if auth?has_content && auth.showTryAnotherWayLink()>
                    <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                        <input type="hidden" name="tryAnotherWay" value="on"/>
                        <a href="#" id="try-another-way" onclick="document.forms['kc-select-try-another-way-form'].submit();return false;">${msg("doTryAnotherWay")}</a>
                    </form>
                </#if>

                <#-- Info section (registration link, etc.) -->
                <#nested "info">

                <#-- Social providers with custom divider -->
                <#if social?? && social.providers?has_content>
                    <div class="volaticloud-divider">
                        <span>Or</span>
                    </div>
                    <div id="kc-social-providers" class="volaticloud-social-providers">
                        <#list social.providers as p>
                            <a href="${p.loginUrl}" id="social-${p.alias}" class="volaticloud-social-btn" title="${p.displayName!}">
                                <#if p.iconClasses?has_content>
                                    <i class="${p.iconClasses}" aria-hidden="true"></i>
                                <#else>
                                    <span class="social-link-text">${p.displayName!}</span>
                                </#if>
                            </a>
                        </#list>
                    </div>
                </#if>
            </div>
        </div>

        <@loginFooter.content />
    </div>

    <#-- Right Panel: Background Image -->
    <div class="volaticloud-image-panel" style="background-image: url('${url.resourcesPath}/img/bg-image.jpg');">
        <div class="volaticloud-image-overlay">
            <h2>Wide selection of technical tools. Experience the world markets.</h2>
            <p>Understanding chart patterns is essential for any trader looking to enhance their technical analysis skills.</p>
        </div>
    </div>
</div>
</body>
</html>
</#macro>