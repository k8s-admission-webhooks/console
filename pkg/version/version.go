package version

// version.Version should be provided at build time with
//-ldflags "-X github.com/k8s-admission-webhooks/console/version.Version $GIT_TAG"
var Version string
