#!/usr/bin/env bash
# Builds the tag the way fdroiddata's "fdroid build" CI job does, in the same buildserver image, so
# the apk is the one F-Droid will rebuild and compare against. Runs as root inside
# registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie, with the recipe at /work/recipe.yml,
# and leaves the unsigned apk at /work/unsigned.apk.
set -euo pipefail

source /etc/profile.d/bsenv.sh
export ANDROID_HOME=/opt/android-sdk

apt-get update
apt-get -y dist-upgrade
sdkmanager "platform-tools" "build-tools;31.0.0"

rm -rf "$fdroidserver"
mkdir "$fdroidserver"
curl --silent https://gitlab.com/fdroid/fdroidserver/-/archive/master/fdroidserver-master.tar.gz |
  tar -xz --directory="$fdroidserver" --strip-components=1
git -C "$home_vagrant/gradlew-fdroid" pull

apt-get install -y sudo openjdk-21-jdk-headless
update-alternatives --set java /usr/lib/jvm/java-21-openjdk-amd64/bin/java

# The recipe with its one build pointed at this tag, and without the published apk it would
# otherwise try to compare against, since this is the build that becomes it
mkdir -p "$home_vagrant/metadata" "$home_vagrant/build" "$home_vagrant/tmp" "$home_vagrant/unsigned"
python3 - <<'EOF'
import os
import yaml

recipe = yaml.safe_load(open("/work/recipe.yml"))
recipe.pop("Binaries", None)
recipe.pop("AllowedAPKSigningKeys", None)
build = recipe["Builds"][-1]
build.update(
    versionName=os.environ["VERSION"],
    versionCode=int(os.environ["VERSION_CODE"]),
    commit=os.environ["COMMIT"],
)
recipe["Builds"] = [build]
recipe["CurrentVersion"] = os.environ["VERSION"]
recipe["CurrentVersionCode"] = int(os.environ["VERSION_CODE"])

with open(os.path.join(os.environ["home_vagrant"], "metadata/social.flotilla.fdroid.yml"), "w") as file:
    yaml.safe_dump(recipe, file, sort_keys=False)
EOF
chown -R vagrant "$home_vagrant"

cd "$home_vagrant"
sudo --preserve-env --user vagrant \
  env PATH="$fdroidserver:$PATH" \
  env PYTHONPATH="$fdroidserver:$fdroidserver/examples" \
  env PYTHONUNBUFFERED=true \
  env HOME="$home_vagrant" \
  fdroid build --verbose --test --refresh-scanner --on-server --no-tarball \
  "social.flotilla.fdroid:$VERSION_CODE"

cp "$home_vagrant/tmp/social.flotilla.fdroid_$VERSION_CODE.apk" /work/unsigned.apk
