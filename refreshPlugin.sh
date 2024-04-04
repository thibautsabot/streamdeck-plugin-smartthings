#!/bin/sh

echo 'Killing the Stream Deck process'

if [[ "$OSTYPE" == "msys" ]]; then
  taskkill //IM "StreamDeck.exe" //F
else
  pkill 'Stream Deck'
fi

pluginName='com.thibautsabot.streamdeck.smartthings'

if [[ "$OSTYPE" == "msys" ]]; then
  pluginsDir="$HOME\AppData\Roaming\Elgato\StreamDeck\Plugins"
else
  pluginsDir="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins"
fi
projectDir=$(PWD)

echo 'Building from sources'
npm run build

echo "Installing the $pluginName plugin to $pluginsDir"

# Push the plugins directory on the stack
pushd "$pluginsDir"

# Check if the plugin directory exists and remove it
[ -d "$pluginName.sdPlugin" ] && rm -r $pluginName.sdPlugin
# Create the plugins directory
mkdir $pluginName.sdPlugin

# Copy content from local folder to Application folder
if [[ "$OSTYPE" == "msys" ]]; then
  cp -R "$projectDir/$pluginName.sdPlugin" .
else
  cp -R "$projectDir/$pluginName.sdPlugin/" $pluginName.sdPlugin
fi

# Pop the plugins directory off the stack returning to where we were
popd

echo "Done installing ${pluginName}"

# Reopen the Stream Deck app on background
if [[ "$OSTYPE" == "msys" ]]; then
  "C:\Program Files\Elgato\StreamDeck\StreamDeck.exe" &
else
  open /Applications/Elgato\ Stream\ Deck.app &
fi
exit