exports.get = function(request, response) {
    request.user.getIdentities({
        success: function(identities) {
            request.respond(200, identities);
        }
    });
};