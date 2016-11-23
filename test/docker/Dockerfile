FROM fedora:25

MAINTAINER Matt Watson <mattdangerw@gmail.com>

# Install flatpak
RUN dnf install flatpak flatpak-builder -y
RUN dnf install nodejs -y

# Install remotes
RUN flatpak remote-add gnome --from https://sdk.gnome.org/gnome.flatpakrepo
RUN flatpak remote-add endless-electron-apps --from https://s3-us-west-2.amazonaws.com/electron-flatpak.endlessm.com/endless-electron-apps.flatpakrepo

# Install flatpak applications. This needs to be done in one layer to avoid
# losing the xattrs in the flatpak repo.
RUN flatpak install gnome \
    org.freedesktop.Platform/x86_64/1.4 org.freedesktop.Sdk/x86_64/1.4 \
    org.freedesktop.Platform/i386/1.4 org.freedesktop.Sdk/i386/1.4 && \
    flatpak install endless-electron-apps \
    io.atom.electron.BaseApp/x86_64/master io.atom.electron.BaseApp/i386/master
