import React, {useMemo, useState, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {Grid, makeStyles} from '@material-ui/core';
import FormButton from './FormButton';
import {ShowNotificationDialog} from '../redux/actions/globalActions';

import {selectCurrentDocumentKeys, selectCurrentDocumentData} from '../redux/selectors/documentSelectors';
import {GenerateField} from '../redux/actions/documentActions';

import DocumentObject from './DocumentObject';
import DocumentArray from './DocumentArray';
import DocumentField from './DocumentField';

import {selectEntityByName} from '../redux/selectors/entitySelectors';
import Axios from '../Axios';
import {produce} from 'immer';

//receive type as blueprint and generate default value for it
function GenerateDefaultFromType(type, defaultValue){
    Object.entries(type).forEach(([key, value])=>{
        // check type and assign
        if(value === 'integer'){
            defaultValue[key] = 0;
        }
        else if(value === 'float'){
            defaultValue[key] = 0;
        }
        else if(value === 'string'){
            defaultValue[key] = '';
        }
        else if(value === 'boolean'){
            defaultValue[key] = false;
        }
        else if(value.constructor === Object){
            defaultValue[key] = {};

            // traverse object
            GenerateDefaultFromType(type[key], defaultValue[key]);
        }
        else if(value.constructor === Array){    
            defaultValue[key] = [];
        }
    });
}

const useStyle = makeStyles(theme => ({
	root:{
		'& > *':{
			marginTop: theme.spacing(0.5),
            marginBottom: theme.spacing(0.5)
		}
	}
}));

function ProcessData(data, files, root){
    if(data.constructor === Object){
        const pairs = Object.entries(data);
        for(let i=0; i<pairs.length; i++){
            const [key, value] = pairs[i];
            if(value instanceof File){
                // add file into files and change data[key] into file name
                const filename = data[key].name.split(/(\\|\/)/g).pop();
                root[filename] = value;
                files.push(filename);
                data[key] = filename;
            }
            else if(value.constructor === Object || value.constructor === Array){
                // traverse object
                ProcessData(data[key], files, root);
            }
        }
    }
    else if(data.constructor === Array){
        for(let i=0; i<data.length; i++){
            if(data[i] instanceof File){
                // add file into files and change data[key] into file name
                const filename = data[i].name.split(/(\\|\/)/g).pop();
                root[filename] = data[i];
                files.push(filename);
                data[i] = filename;
            }
            else if(data[i].constructor === Object || data[i].constructor === Array){
                // traverse object
                ProcessData(data[i], files, root);
            }
        }    
    }
}

function DocumentAdd(props){
    const style = useStyle();
    const dispatch = useDispatch();
    const {entity} = props.match.params;

    const selectEntity = useMemo(selectEntityByName, []);
    const _entity = useSelector(state => selectEntity(state, entity));
    const selectKeys = useMemo(selectCurrentDocumentKeys, []);
    const keys = useSelector(state => selectKeys(state));

    const currentValue = useSelector(selectCurrentDocumentData);

    const [generate, setGenerate] = useState(false);

    useEffect(()=>{
        if(_entity){
            let defaultValue = {};
            GenerateDefaultFromType(_entity.schema, defaultValue);
            dispatch(GenerateField(_entity.schema, defaultValue));
            setGenerate(true);
        }
    }, [_entity]);

    if(!generate) return null;
    
    return(
        <Grid container className={style.root} direction="column">
            <Grid container item direction="column" xs={12} sm={6} md={8} lg={6}>
                {
                    keys.map(value => {
                        const {key, type} = value;
                        const temp = [key];
                        if(type === 'object'){
                            return(
                                <DocumentObject key={key} keys={temp}/>
                            )
                        }
                        else if(type === 'array'){
                            return(
                                <DocumentArray key={key} keys={temp}/>
                            )
                        }else{
                            return(
                                <DocumentField key={key} keys={temp} category={type}/>
                            )
                        }
                    })
                }
            </Grid>
            <FormButton color="secondary" variant="contained" xs={12} 
                onClick={async() => {
                    try{
                        const newState = produce({
                            data: currentValue, 
                            files: []
                        }, draft => ProcessData(draft.data, draft.files, draft));

                        const formdata = new FormData();
                        const {data, files} = newState;
                        formdata.set('data', JSON.stringify(data));
                        files.forEach(value => {
                            formdata.append('files[]', newState[value], value);
                        });

                        await Axios.post(
                            `document/${_entity.id}`, 
                            formdata, 
                            {'Content-Type': 'multipart/form-data'}
                        );
                        
                        dispatch(ShowNotificationDialog(
                            'Add Document', 
                            'Succeed adding new document'
                        ));
                    }catch(err){
                        dispatch(ShowNotificationDialog(
                            'Add Document', 
                            `Failed adding new document, ${err}`
                        ));
                    }
                }}
            >
                Add
            </FormButton>
        </Grid>
    )
}

export default DocumentAdd;