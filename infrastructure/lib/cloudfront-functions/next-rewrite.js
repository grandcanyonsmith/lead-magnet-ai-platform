function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // Check if the URI is missing an extension.
    if (uri.indexOf('.') === -1) {
        if (uri.endsWith('/')) {
            request.uri = uri + 'index.html';
        } else {
            request.uri = uri + '.html';
        }
    }
    
    return request;
}
