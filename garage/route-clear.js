if($("from")) $("from").value="";
if($("to")) $("to").value="";
var _go=$("go")&&$("go").onclick;
if($("go"))$("go").onclick=async function(){
  if(!$("from").value.trim()){showErr("Enter a start point.");return}
  if(!$("to").value.trim()){showErr("Enter a destination.");return}
  return _go.apply(this,arguments);
};
