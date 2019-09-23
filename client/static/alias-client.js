const Alias = {};

Alias.request = async function(aliasID, contract) {
    const re = /^([a-zA-Z0-9\-\.\_]+)@([a-zA-Z\-\.\_]+)$/;
    const match = $("#name").val().match(re);
    if (!match) {
        throw "bad alias";
    }

    const username = match[1];
    const authzDomain = match[2];

    chain.verify(contract);

    const r = await $.ajax(`//${authzDomain}/alias/`);
    if (r.what != "alias authz server") {
        throw "'" + authzDomain + "' is not an alias server";
    }

    let reqURL = `//${authzDomain}/${r.reqPath}?`;
    reqURL += 'contract=' + encodeURIComponent(chain.toToken(contract)) + '&';
    reqURL += 'username=' + encodeURIComponent(username);

    //console.log(reqURL);
    window.location.href = reqURL;
}
