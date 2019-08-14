function run() {
    const selfURL = new URL(window.location.href);
    const clientId = `${selfURL.protocol}//${selfURL.host}/alias/`;

    $("#alias-login").click(function() {
        $("#name").show().focus();
    });

    function error(m) {
        alert(m);
    }

    $("#login").on("submit", function(e) {
        const re = /^([a-zA-Z0-9\-\.\_]+)@([a-zA-Z\-\.\_]+)$/;
        const match = $("#name").val().match(re);
        if (!match) {
            alert("bad alias");
            return false;
        }

        const username = match[1];
        const authzDomain = match[2];
        const scopes = $("#scopes").val();

        const baseUrl = `//${authzDomain}/alias/`;

        $.ajax(baseUrl)
            .then((r) => {
                if (r.what != "alias authz server") {
                    return alert("not an alias server");
                }

                let reqURL = `//${authzDomain}/${r.reqPath}?`;
                reqURL += 'client_id=' + encodeURIComponent(clientId) + '&';
                reqURL += 'username=' + encodeURIComponent(username) + '&';
                reqURL += 'scopes=' + encodeURIComponent(scopes);
                window.location.href = reqURL;
            })
            .catch(() => {
                alert("something went wrong");
            })
        ;

        return false;
    });

    $("#clear_all_grants").click(function() {
        $.ajax({
            url: "/clear_grants",
            method: 'POST'
        }).done(function() {
            window.location.reload();
        }).fail(function() {
            alert("server error");
        });
    });
}

