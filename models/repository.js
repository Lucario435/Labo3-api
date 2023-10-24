import fs from "fs";
import { v1 as uuidv1 } from "uuid";
import * as utilities from "../utilities.js";
import { log } from "../log.js";
import RepositoryCachesManager from "./repositoryCachesManager.js";

globalThis.jsonFilesPath = "jsonFiles";
globalThis.repositoryEtags = {};

class CollectionFilter {
    constructor(objects, params, model)
    {
        this.objects = objects
        this.params = params
        this.model = model
    }
    get()
    {
        let objectList = [];
        if(this.params != null)
        {
            //sort
            if(this.params["sort"] != null && this.params["sort"].trim() != "")
            {
                if(this.params["sort"].includes(',[desc]'))
                {
                    let sort = this.params["sort"].replace(',[desc]', '').trim();
                    let sortBy = sort;
                    objectList = this.objects.sort((a, b) => {
                        if (a[sortBy] > b[sortBy]) {
                        return -1;
                        }
                    });
                }
                else if (this.params["sort"].includes(',[asc]'))
                {         
                    let sort = this.params["sort"].replace(',[asc]', '').trim();
                    let sortBy = sort;
                    objectList = this.objects.sort((a, b) => {
                        if (a[sortBy] < b[sortBy]) {
                        return -1;
                        }
                    });
                }
                else
                {
                    const sortBy = this.params["sort"];
                    console.log(sortBy)
                    objectList = this.objects.sort((a, b) => {
                        if (a[sortBy] < b[sortBy]) {
                        return -1;
                        }
                    });
                }
                /*
                else{
                    //Make a response that has error
                    objectList.push({'status' : "error", 'message' : "This is not a supported sort, try another sort like Name, Category or Url..."});
                }
                */
            }
            //Si pas field
            //Si pas limit
            //Recherche par noms
            else if(this.params != null)
            {
                const values = Object.values(this.params);
                const keys = Object.keys(this.params);

                const valuesString = JSON.stringify(values).replace(/[\[\]"]/g, '');
                const keysString = JSON.stringify(keys).replace(/[\[\]"]/g, '');
                if(!valuesString.includes('*') && valuesString.trim() != "")
                {
                    let found = false;
                    this.objects.forEach(object => {
                        if(valuesString == object[keysString])
                        {
                            objectList.push(object);
                            found = true;
                        }
                    });
                    if(!found)
                    {
                        objectList.push({'status' : "error", 'message' : valuesString.replace(/[\[\]"*]/g,'') + " was not found in this model"});
                    }
                }
                else
                {
                    //SI l'élément commence avec ...
                    if(valuesString.endsWith('*') && !valuesString.startsWith('*'))
                    {
                        let found = false;
                        this.objects.forEach(object => {
                            if(object[keysString].startsWith(valuesString.replace(/[\[\]"*]/g,'')))
                            {
                                objectList.push(object);
                                found = true;
                            }
                        });
                        if(!found)
                        {
                            objectList.push({'status' : "error", 'message' : "Nothing starts with : ("+ valuesString.replace(/[\[\]"*]/g,'') + ") in this model"});
                        }
                    }
                    //SI l'élément contient ...
                    else if(valuesString.startsWith('*') && valuesString.endsWith('*') )
                    {
                        let newValue = valuesString.replace(/[\[\]"*]/g,'')
                        let found = false;
                        this.objects.forEach(object => {
                            if(object[keysString].includes(newValue))
                            {
                                objectList.push(object);
                                found = true;
                            }
                        });
                        if(!found)
                        {
                            objectList.push({'status' : "error", 'message' : "Nothing contains : ("+ valuesString.replace(/[\[\]"*]/g,'') + ") in this model"});
                        }
                    }
                    //SI l'élément fini avec ...
                    else if(valuesString.startsWith('*') && !valuesString.endsWith('*'))
                    {
                        let found = false;
                        this.objects.forEach(object => {
                            if(object[keysString].endsWith(valuesString.replace(/[\[\]"*]/g,'')))
                            {
                                objectList.push(object);
                                found = true;
                            }
                        });
                        if(!found)
                        {
                            objectList.push({'status' : "error", 'message' : "Nothing ends with : ("+ valuesString.replace(/[\[\]"*]/g,'') + ") in this model"});
                        }
                    }
                    else
                    {
                        objectList.push({'status' : "error", 'message' : "This api needs parameters to work..."});

                    }
                }
            }
            //If all params are null
            else
            {
                objectList = this.objects;
            }
        }
        //If no params
        else
        {
            objectList = this.objects;
        }
        return objectList;
    }
}
export default class Repository {
    constructor(ModelClass, cached = true) {
        this.objectsList = null;
        this.model = ModelClass;
        this.objectsName = ModelClass.getClassName() + "s";
        this.objectsFile = `./jsonFiles/${this.objectsName}.json`;
        this.initEtag();
        this.cached = cached;
    }
    initEtag() {
        if (this.objectsName in repositoryEtags)
            this.ETag = repositoryEtags[this.objectsName];
        else this.newETag();
    }
    newETag() {
        this.ETag = uuidv1();
        repositoryEtags[this.objectsName] = this.ETag;
    }
    objects() {
        if (this.objectsList == null) this.read();
        return this.objectsList;z
    }
    read() {
        this.objectsList = null;
        if (this.cached) {
          this.objectsList = RepositoryCachesManager.find(this.objectsName);
        }
        if (this.objectsList == null) {
          try {
            let rawdata = fs.readFileSync(this.objectsFile);
            // we assume here that the json data is formatted correctly
            this.objectsList = JSON.parse(rawdata);
            if (this.cached)
              RepositoryCachesManager.add(this.objectsName, this.objectsList);
          } catch (error) {
            if (error.code === 'ENOENT') {
              // file does not exist, it will be created on demand
              log(FgYellow,`Warning ${this.objectsName} repository does not exist. It will be created on demand`);
              this.objectsList = [];
            } else {
              log(FgRed,`Error while reading ${this.objectsName} repository`);
              log(FgRed,'--------------------------------------------------');
              log(FgRed,error);
            }
          }
        }
      }
      write() {
        this.newETag();
        fs.writeFileSync(this.objectsFile, JSON.stringify(this.objectsList));
        if (this.cached) {
          RepositoryCachesManager.add(this.objectsName, this.objectsList);
        }
      }
    nextId() {
        let maxId = 0;
        for (let object of this.objects()) {
            if (object.Id > maxId) {
                maxId = object.Id;
            }
        }
        return maxId + 1;
    }
    checkConflict(instance) {
        let conflict = false;
        if (this.model.key)
            conflict = this.findByField(this.model.key, instance[this.model.key], instance.Id) != null;
        if (conflict) {
            this.model.addError(`Unicity conflict on [${this.model.key}]...`);
            this.model.state.inConflict = true;
        }
        return conflict;
    }
    add(object) {
        delete object.Id;
        object = { "Id": 0, ...object };
        this.model.validate(object);
        if (this.model.state.isValid) {
            this.checkConflict(object);
            if (!this.model.state.inConflict) {
                object.Id = this.nextId();
                this.model.handleAssets(object);
                this.objectsList.push(object);
                this.write();
            }
        }
        return object;
    }
    update(id, objectToModify) {
        delete objectToModify.Id;
        objectToModify = { Id: id, ...objectToModify };
        this.model.validate(objectToModify);
        if (this.model.state.isValid) {
            let index = this.indexOf(objectToModify.Id);
            if (index > -1) {
                this.checkConflict(objectToModify);
                if (!this.model.state.inConflict) {
                    this.model.handleAssets(objectToModify, this.objectsList[index]);
                    this.objectsList[index] = objectToModify;
                    this.write();
                }
            } else {
                this.model.addError(`The ressource [${objectToModify.Id}] does not exist.`);
                this.model.state.notFound = true;
            }
        }
        return objectToModify;
    }
    remove(id) {
        let index = 0;
        for (let object of this.objects()) {
            if (object.Id === id) {
                this.model.removeAssets(object)
                this.objectsList.splice(index, 1);
                this.write();
                return true;
            }
            index++;
        }
        return false;
    }
    getAll(params = null) {
        // Todo Labo 3
        let collectionFilter = new CollectionFilter(this.objects(), params, this.model);
        let objectsList = collectionFilter.get();

        let bindedDatas = [];
        if (objectsList)
            for (let data of objectsList) {
                bindedDatas.push(this.model.bindExtraData(data));
            };
        return bindedDatas;
    }
    get(id) {
        for (let object of this.objects()) {
            if (object.Id === id) {
                return this.model.bindExtraData(object);
            }
        }
        return null;
    }
    removeByIndex(indexToDelete) {
        if (indexToDelete.length > 0) {
            utilities.deleteByIndex(this.objects(), indexToDelete);
            this.write();
        }
    }
    findByField(fieldName, value, excludedId = 0) {
        if (fieldName) {
            let index = 0;
            for (let object of this.objects()) {
                try {
                    if (object[fieldName] === value) {
                        if (object.Id != excludedId) return this.objectsList[index];
                    }
                    index++;
                } catch (error) { break; }
            }
        }
        return null;
    }
    indexOf(id) {
        let index = 0;
        for (let object of this.objects()) {
            if (object.Id === id) return index;
            index++;
        }
        return -1;
    }
}
