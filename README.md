# WebAppPlayground

A playground for web app

```bash
# to build code
bash scripts/build_code.sh

# to perform steps that trigger github action
# it pushes new commits from main to frozen branch
# there, github action builds the code, builds the docker image and publishes it
bash scripts/release_staging.sh
```

## Testing web app

```bash

# URL=http://localhost:7867
URL=https://app-ap275eimpvs76.greensmoke-12076a51.germanywestcentral.azurecontainerapps.io/

curl $URL?name=testname
curl $URL/status
curl -X POST $URL/inc -d '{"name":"Alice"}' -H "Content-Type: application/json"
curl -X POST $URL/blob-store -d '{}' -H "Content-Type: application/json"
curl $URL/blob-store
```
