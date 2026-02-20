const fetch = require('node-fetch');
async function test() {
    try {
        const res = await fetch('http://localhost:8080/api/calls/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: '+57000000000',
                businessName: 'My Local Test',
                businessType: 'Testing'
            })
        });
        console.log(await res.text());
    } catch (e) {
        console.error(e);
    }
}
test();
