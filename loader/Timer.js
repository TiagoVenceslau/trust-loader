const handler = setInterval(() => {
    if (!document.cookie.includes("accessTokenCookie") && document.cookie.includes("isActiveSession")) {
        clearInterval(handler);
        window.location = "/logout"
    }
}, 1000);
