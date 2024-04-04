'use strict';

const { getStatusCode, getErrorText } = require('imapflow/lib/tools.js');
const { searchCompiler } = require('imapflow/lib/search-compiler.js');

// Updates flags for a message
module.exports = async (connection, sorttype, query) => {
    if (connection.state !== connection.states.SELECTED) {
        // nothing to do here
        return false;
    }

    if (!connection.capabilities.has('SORT')) {
        return false;
    }

     let attributes;

    if (!query || query === true || (typeof query === 'object' && (!Object.keys(query).length || (Object.keys(query).length === 1 && query.all)))) {
        // search for all messages
        attributes = [{ type: 'ATOM', value: 'ALL' }];
    } else if (query && typeof query === 'object') {
        // normal query
        attributes = searchCompiler(connection, query);
    } else {
        return false;
    }
    
    attributes.splice(0,1);
    attributes.unshift({ type: 'TEXT', value: sorttype, sensitive: true});


    let results = new Set();
    try {
        let response = await connection.exec('SORT', attributes,{
            untagged: {
                SORT: async untagged => {
                    if (untagged && untagged.attributes && untagged.attributes.length) {
                        untagged.attributes.forEach(attribute => {
                            if (attribute && attribute.value && typeof attribute.value === 'string' && !isNaN(attribute.value)) {
                                results.add(Number(attribute.value));
                            }
                        });
                    }
                }
            }
        });
        response.next();
        return results;
    } catch (err) {
        let errorCode = getStatusCode(err.response);
        if (errorCode) {
            err.serverResponseCode = errorCode;
        }
        err.response = await getErrorText(err.response);

        connection.log.warn({ err, cid: connection.id });
        return false;
    }
};
