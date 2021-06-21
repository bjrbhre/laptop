# Clamav Setup

## Install

Mac OS
```
brew install --appdir="/Applications" clamav
```

## Config

```
cp *.conf /usr/local/etc/clamav
```


## Update the database

```
freshclam
```

## Start the deamon

```
sudo /usr/local/sbin/clamd
```

## Monitor

```
clamdtop
```

## Testing

```
curl https://secure.eicar.org/eicar.com.txt -o eicar.com.txt
clamscan
```
