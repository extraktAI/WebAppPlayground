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
