// const url = process.env.URL;
// const qurl = process.env.Q_URL;
// const token = process.env.TOKEN

const token = "BQD6sEm-ZU3jv4dqmYX78n6sQRGNVZ6YqKpT9crHbodI3Iq128aNjVqabLH4AY42hnVdtCnSxDNojPwnvKu1i3hvst51Dm0Fehc47YjIW7dW0QK9jo0"
const url = "https://open.spotify.com/track/4C4YqvRrjtkzy0NewEq4Zj?si=3e3b5f0adbb14632";
var qurl = "https://api.spotify.com/v1/21t7amyjhc7rng43uf4jvqkni/player/queue?uri=spotify%"

const uri = url.match(/(?<=track\/)[a-zA-Z0-9]+(?=\?|[a-zA-Z0-9]*)/);
qurl += uri;

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer BQD6sEm-ZU3jv4dqmYX78n6sQRGNVZ6YqKpT9crHbodI3Iq128aNjVqabLH4AY42hnVdtCnSxDNojPwnvKu1i3hvst51Dm0Fehc47YjIW7dW0QK9jo0',
  },
}).then(response => {
  // Send the response status code to %output0%
  console.log(response.status);
});
