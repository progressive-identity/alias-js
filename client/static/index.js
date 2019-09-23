const chain = new Anychain();

function run() {
    const selfURL = new URL(window.location.href);

    $("#alias-login").click(function() {
        $("#name").show().focus();
    });

    function error(m) {
        alert(m);
    }

    $("#login").on("submit", function(e) {
        const aliasID = $("#name").val();

        $.ajax("contract.json").then((r) => {
            const contract = chain.fromJSON(r);

            Alias.request(aliasID, contract).catch((e) => {
                alert(e);
            });
        });

        return false;
    });
}

