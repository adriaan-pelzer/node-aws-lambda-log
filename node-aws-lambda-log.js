#! /usr/bin/env node

var bb = require ( 'bluebird' );
var hl = require ( 'highland' );
var _ = require ( 'lodash' );
var args = require ( 'minimist' )( process.argv );
var aws = require ( 'aws-sdk' );
var cwl = bb.promisifyAll ( new aws.CloudWatchLogs ( { region: args.region || 'eu-west-1' } ) );

var functionName = args.f || args.function;

if ( _.isUndefined ( functionName ) ) {
    console.log ( 'Usage: node aws-lambda-log.js -r|--region <aws region> -f|--function <functionName>' );
    console.log ( 'Display logs from the latest updated cloudwatch logstream associated with the Lambda function specified' );
    console.log ( '' );
    console.log ( 'AWS credentials should be configured in ~/.aws/credentials as such:' );
    console.log ( '    [default]' );
    console.log ( '    aws_access_key_id = ACCESS_KEY_ID' );
    console.log ( '    aws_secret_access_key = SECRET_ACCESS_KEY' );
    process.exit ( 1 );
}

hl ( cwl.describeLogStreamsAsync ( { logGroupName: '/aws/lambda/' + functionName } ) )

.map ( function ( response ) {
    return _.reduce ( response.logStreams, function ( latestLogStream, logStream ) {
        return ( latestLogStream.lastIngestionTime < logStream.lastIngestionTime ) ? logStream : latestLogStream;
    } );
} )

.flatMap ( function ( latestLogStream ) {
    return hl ( cwl.getLogEventsAsync ( { logGroupName: '/aws/lambda/' + functionName, logStreamName: latestLogStream.logStreamName } ) )

    .flatMap ( function ( response ) {
        return hl ( response.events );
    } );
} )

.errors ( function ( error, push ) {
    console.error ( error );
} )

.map ( function ( log ) {
    return ( new Date ( log.timestamp ) ).toISOString () + ': ' + log.message;
} )

.each ( console.log );
