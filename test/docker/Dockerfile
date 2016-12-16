FROM fedora:25

MAINTAINER Matt Watson <mattdangerw@gmail.com>

# Install flatpak
RUN dnf install flatpak flatpak-builder -y
RUN dnf install nodejs -y

# Install remotes
RUN flatpak remote-add gnome --from https://sdk.gnome.org/gnome.flatpakrepo
RUN flatpak remote-add endless-electron-apps --from https://s3-us-west-2.amazonaws.com/electron-flatpak.endlessm.com/endless-electron-apps.flatpakrepo
