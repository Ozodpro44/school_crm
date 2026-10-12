# Legacy scripts - DO NOT RUN IN PRODUCTION

These one-off scripts were moved out of the backend root. They are kept for
history only.

WARNING: several of them (`grant_permissions.sh`, `fix_permissions_direct.sh`,
`fix_permissions.sql`, `grant_subscription_permissions.sql`,
`fix_missing_permissions.sql`) issue `GRANT ALL PRIVILEGES` on databases,
tables or sequences. Running them gives the target role far more access than the
application needs and defeats least-privilege database roles.

`EXAMPLES.sh` contains sample curl calls with placeholder credentials.

If you need to adjust database privileges, write a reviewed migration or grant
only the specific privileges the application role requires.
