window.sodium = {
    onload: function (sodium) {
        console.debug("libsodium ready");
        $(function() {
            run();
        });
    }
};
