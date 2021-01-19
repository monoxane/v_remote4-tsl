# V_Remote4 TSL

A microservice to take TSL tally and shove it into a Lawo V_Remote4 via Ember+ to update the MultiView overlays.
It will also take the Source Labels (ripped from the SDP) and send it via TSL or RossTalk to your tally management or Carbonite/Acuity in real time as the sources change.

## Deployment

0. Install Docker + docker-compose blah blah
1. Copy `config.example.js` to `config.js`
2. Update the V_Remote4 IP and TSL addresses in the config
3. `docker-compose up -d`
4. Send it TSL data via UDP on port 5001 (Tested with tslumd1.0 from a Carbonite)
5. ??? 
6. ~~Profit!~~ Production!
