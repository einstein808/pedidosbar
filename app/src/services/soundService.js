import { Audio } from 'expo-av';

let soundObject = null;

export async function playOrderReadySound() {
  try {
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      require('../../../assets/sounds/order_ready.wav'),
      { shouldPlay: true, volume: 1.0 }
    );
    soundObject = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
        soundObject = null;
      }
    });
  } catch (error) {
    console.log('Sound playback error:', error);
  }
}

export async function playNewOrderSound() {
  try {
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      require('../../../assets/sounds/new_order.wav'),
      { shouldPlay: true, volume: 0.8 }
    );
    soundObject = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
        soundObject = null;
      }
    });
  } catch (error) {
    console.log('Sound playback error:', error);
  }
}
