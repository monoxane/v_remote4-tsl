# V_Remote4 TSL

A microservice to take TSL tally and shove it into a Lawo V_Remote4 via Ember+ to update the MultiView overlays.

This will also do the reverse at some point in the future and take an input source ID and update a TSL address with that information (to sync a VMU Input Mnemonic with the recieving channel for example).

## Deployment

0. Install Docker + docker-compose blah blah
1. Copy `config.example.js` to `config.js`
2. Update the V_Remote4 IP and TSL addresses in `pipmap`
3. `docker-compose up -d`
4. ??? 
5. ~~Profit!~~ Production!