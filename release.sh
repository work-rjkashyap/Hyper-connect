#!/bin/bash
VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./release.sh v1.0.0"
  exit 1
fi

git add .
git commit -m "Release $VERSION"
git push
git tag $VERSION
git push origin $VERSION

echo "✅ Release $VERSION triggered!"