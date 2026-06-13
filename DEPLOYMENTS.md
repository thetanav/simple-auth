I want 3 pods/containers

postgres
server
client


# Postgres Run

```bash

docker run --name postgres -e POSTGRES_USERNAME=postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres

```
